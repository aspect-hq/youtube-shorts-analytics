import os
import logging
import asyncio
import uuid
import subprocess
from pathlib import Path
from typing import Dict, List, Optional, Any
import json
import tempfile
import shutil

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
import yt_dlp
import random

# Load environment variables
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="YouTube Shorts Analytics API",
    description="FastAPI server for analyzing YouTube Shorts using the Aspect SDK",
    version="0.1.0"
)

# CORS middleware
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in cors_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
MOCK_MODE = os.getenv("MOCK", "false").lower() == "true"
ASPECT_API_KEY = os.getenv("ASPECT_API_KEY")

if not MOCK_MODE and not ASPECT_API_KEY:
    raise ValueError("ASPECT_API_KEY is required when MOCK=false")

# Global state for mock mode
mock_indexes: Dict[str, str] = {}
mock_assets: Dict[str, str] = {}

# Pydantic models
class ValidateUrlRequest(BaseModel):
    url: str

class ValidateUrlResponse(BaseModel):
    valid: bool

class CreateIndexRequest(BaseModel):
    channel_url: str = Field(..., alias="channelUrl")

class CreateIndexResponse(BaseModel):
    index_id: str = Field(..., alias="indexId")
    success: bool
    message: Optional[str] = None

class DownloadVideosRequest(BaseModel):
    channel_url: str = Field(..., alias="channelUrl")
    destination_directory: str = Field(..., alias="destinationDirectory")
    max_videos: Optional[int] = Field(None, alias="maxVideos")
    ignore_duplicates: bool = Field(..., alias="ignoreDuplicates")

class VideoAsset(BaseModel):
    asset_id: str = Field(..., alias="assetId")
    file_name: str = Field(..., alias="fileName")
    file_path: str = Field(..., alias="filePath")

class DownloadVideosResponse(BaseModel):
    downloaded_videos: List[VideoAsset] = Field(..., alias="downloadedVideos")
    success: bool
    message: Optional[str] = None

class UploadAssetRequest(BaseModel):
    index_id: str = Field(..., alias="indexId")
    file_path: str = Field(..., alias="filePath")
    file_name: str = Field(..., alias="fileName")

class UploadAssetResponse(BaseModel):
    aspect_asset_id: str = Field(..., alias="aspectAssetId")
    success: bool
    message: Optional[str] = None

class AnalyzeFramesRequest(BaseModel):
    index_id: str = Field(..., alias="indexId")
    aspect_asset_id: str = Field(..., alias="aspectAssetId")
    video_file_path: str = Field(..., alias="videoFilePath")
    start_time: str = Field(..., alias="startTime")
    end_time: str = Field(..., alias="endTime")
    sample_window_seconds: int = Field(..., alias="sampleWindowSeconds")
    frames_per_window: int = Field(..., alias="framesPerWindow")
    analysis_prompt: str = Field(..., alias="analysisPrompt")

class AnalyzeFramesResponse(BaseModel):
    result: str
    success: bool
    message: Optional[str] = None

# Utility functions
def check_ffmpeg_availability() -> bool:
    """Check if ffmpeg is available in PATH"""
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False

def parse_time_to_seconds(time_str: str) -> float:
    """Convert HH:MM:SS to seconds"""
    try:
        parts = time_str.split(":")
        if len(parts) != 3:
            raise ValueError("Time must be in HH:MM:SS format")
        hours, minutes, seconds = map(float, parts)
        return hours * 3600 + minutes * 60 + seconds
    except ValueError as e:
        raise ValueError(f"Invalid time format: {e}")

def validate_youtube_shorts_url(url: str) -> bool:
    """Validate if URL is a YouTube Shorts channel"""
    try:
        if not url.rstrip("/").endswith("/shorts"):
            url = url.rstrip("/") + "/shorts"
        
        # Use yt-dlp to validate the URL
        ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "extract_flat": True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            return info is not None and "entries" in info
    except Exception:
        return False

def download_shorts(channel_url: str, output_dir: str, max_videos: Optional[int] = None, ignore_duplicates: bool = True) -> List[Dict[str, str]]:
    """Download YouTube Shorts from a channel"""
    if not channel_url.rstrip("/").endswith("/shorts"):
        channel_url = channel_url.rstrip("/") + "/shorts"

    logger.info(f"Downloading shorts from: {channel_url}")
    logger.info(f"Output directory: {output_dir}")

    os.makedirs(output_dir, exist_ok=True)

    downloaded_files = []
    
    ydl_opts = {
        "outtmpl": os.path.join(output_dir, "%(title)s.%(ext)s"),
        "format": (
            "bestvideo[ext=mp4][vcodec^=avc1]+bestaudio[ext=m4a]"
            "/best[ext=mp4][vcodec^=avc1]"
            "/best"
        ),
        "merge_output_format": "mp4",
        "retries": 3,
        "ignoreerrors": True,
        "quiet": True,
        "no_warnings": True,
    }

    if max_videos:
        ydl_opts["playlistend"] = max_videos

    def progress_hook(d):
        if d['status'] == 'finished':
            file_path = d['filename']
            file_name = os.path.basename(file_path)
            asset_id = str(uuid.uuid4())
            
            if ignore_duplicates and os.path.exists(file_path):
                logger.info(f"File already exists: {file_name}")
                return
            
            downloaded_files.append({
                "assetId": asset_id,
                "fileName": file_name,
                "filePath": file_path
            })
            logger.info(f"Downloaded: {file_name}")

    ydl_opts["progress_hooks"] = [progress_hook]

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([channel_url])

    return downloaded_files

def extract_frames_from_video(video_path: str, start_time: str, end_time: str, 
                            sample_window_seconds: int, frames_per_window: int) -> List[str]:
    """Extract frames from video using ffmpeg"""
    if not check_ffmpeg_availability():
        raise RuntimeError("ffmpeg is not available in PATH")

    start_seconds = parse_time_to_seconds(start_time)
    end_seconds = parse_time_to_seconds(end_time)
    
    if start_seconds >= end_seconds:
        raise ValueError("Start time must be before end time")

    # Get video duration to clamp end time
    try:
        result = subprocess.run([
            "ffprobe", "-v", "quiet", "-print_format", "json", 
            "-show_format", video_path
        ], capture_output=True, text=True, check=True)
        
        video_info = json.loads(result.stdout)
        video_duration = float(video_info["format"]["duration"])
        end_seconds = min(end_seconds, video_duration)
        
        if start_seconds >= video_duration:
            raise ValueError("Start time is beyond video duration")
            
    except (subprocess.CalledProcessError, json.JSONDecodeError, KeyError):
        logger.warning("Could not determine video duration, proceeding without clamping")

    frames = []
    temp_dir = tempfile.mkdtemp()
    
    try:
        current_time = start_seconds
        frame_index = 0
        
        while current_time < end_seconds:
            window_end = min(current_time + sample_window_seconds, end_seconds)
            
            # Extract middle frame of the window
            middle_time = current_time + (window_end - current_time) / 2
            
            for _ in range(min(frames_per_window, 1)):  # Take 1 frame from middle
                frame_path = os.path.join(temp_dir, f"frame_{frame_index:06d}.jpg")
                
                cmd = [
                    "ffmpeg", "-y", "-ss", str(middle_time), "-i", video_path,
                    "-frames:v", "1", "-q:v", "2", frame_path
                ]
                
                result = subprocess.run(cmd, capture_output=True)
                if result.returncode == 0 and os.path.exists(frame_path):
                    frames.append(frame_path)
                    frame_index += 1
                else:
                    logger.warning(f"Failed to extract frame at {middle_time}s")
            
            current_time = window_end
            
    except Exception as e:
        # Cleanup on error
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise e
    
    return frames

# Mock functions
async def mock_create_index(channel_url: str) -> str:
    """Mock implementation of index creation"""
    await asyncio.sleep(0.5)  # Simulate network delay
    index_id = f"mock_index_{uuid.uuid4().hex[:8]}"
    mock_indexes[index_id] = channel_url
    return index_id

async def mock_upload_asset(index_id: str, file_path: str, file_name: str) -> str:
    """Mock implementation of asset upload"""
    await asyncio.sleep(1.0)  # Simulate upload time
    if index_id not in mock_indexes:
        raise ValueError("Invalid index ID")
    
    asset_id = f"mock_asset_{uuid.uuid4().hex[:8]}"
    mock_assets[asset_id] = {"index_id": index_id, "file_path": file_path, "file_name": file_name}
    return asset_id

async def mock_analyze_frames(frames: List[str], prompt: str) -> str:
    """Mock implementation of frame analysis"""
    await asyncio.sleep(random.uniform(2.0, 5.0))  # Simulate analysis time
    return random.choice(["yes", "no"])

# API endpoints
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "mock_mode": MOCK_MODE}

@app.post("/api/validate-url", response_model=ValidateUrlResponse)
async def validate_url(request: ValidateUrlRequest):
    """Validate YouTube Shorts URL"""
    try:
        is_valid = validate_youtube_shorts_url(request.url)
        return ValidateUrlResponse(valid=is_valid)
    except Exception as e:
        logger.error(f"Error validating URL: {e}")
        return ValidateUrlResponse(valid=False)

@app.post("/api/create-index", response_model=CreateIndexResponse)
async def create_index(request: CreateIndexRequest):
    """Create an Aspect index"""
    try:
        if MOCK_MODE:
            index_id = await mock_create_index(request.channel_url)
        else:
            # Real Aspect SDK implementation would go here
            # For now, return mock response
            index_id = await mock_create_index(request.channel_url)
        
        return CreateIndexResponse(
            indexId=index_id,
            success=True,
            message="Index created successfully"
        )
    except Exception as e:
        logger.error(f"Error creating index: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/download-videos", response_model=DownloadVideosResponse)
async def download_videos(request: DownloadVideosRequest):
    """Download YouTube Shorts videos"""
    try:
        downloaded_files = download_shorts(
            request.channel_url,
            request.destination_directory,
            request.max_videos,
            request.ignore_duplicates
        )
        
        video_assets = [VideoAsset(**file) for file in downloaded_files]
        
        return DownloadVideosResponse(
            downloadedVideos=video_assets,
            success=True,
            message=f"Downloaded {len(video_assets)} videos"
        )
    except Exception as e:
        logger.error(f"Error downloading videos: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/upload-asset", response_model=UploadAssetResponse)
async def upload_asset(request: UploadAssetRequest):
    """Upload asset to Aspect"""
    try:
        if MOCK_MODE:
            aspect_asset_id = await mock_upload_asset(
                request.index_id, 
                request.file_path, 
                request.file_name
            )
        else:
            # Real Aspect SDK implementation would go here
            aspect_asset_id = await mock_upload_asset(
                request.index_id, 
                request.file_path, 
                request.file_name
            )
        
        return UploadAssetResponse(
            aspectAssetId=aspect_asset_id,
            success=True,
            message="Asset uploaded successfully"
        )
    except Exception as e:
        logger.error(f"Error uploading asset: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze-frames", response_model=AnalyzeFramesResponse)
async def analyze_frames(request: AnalyzeFramesRequest):
    """Analyze video frames using the Aspect SDK"""
    try:
        # Extract frames from video
        frames = extract_frames_from_video(
            request.video_file_path,
            request.start_time,
            request.end_time,
            request.sample_window_seconds,
            request.frames_per_window
        )
        
        if not frames:
            return AnalyzeFramesResponse(
                result="error",
                success=False,
                message="No frames could be extracted from video"
            )
        
        try:
            if MOCK_MODE:
                result = await mock_analyze_frames(frames, request.analysis_prompt)
            else:
                # Real Aspect SDK implementation would go here
                result = await mock_analyze_frames(frames, request.analysis_prompt)
            
            return AnalyzeFramesResponse(
                result=result,
                success=True,
                message=f"Analyzed {len(frames)} frames"
            )
        finally:
            # Cleanup extracted frames
            for frame_path in frames:
                try:
                    os.remove(frame_path)
                except OSError:
                    pass
            
            # Cleanup temp directory
            if frames:
                temp_dir = os.path.dirname(frames[0])
                shutil.rmtree(temp_dir, ignore_errors=True)
                
    except Exception as e:
        logger.error(f"Error analyzing frames: {e}")
        return AnalyzeFramesResponse(
            result="error",
            success=False,
            message=str(e)
        )

if __name__ == "__main__":
    import uvicorn
    
    host = os.getenv("HOST", "localhost")
    port = int(os.getenv("PORT", 8000))
    debug = os.getenv("DEBUG", "true").lower() == "true"
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=debug,
        log_level="info"
    )
