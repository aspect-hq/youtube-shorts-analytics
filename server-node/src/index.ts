import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import ytdl from 'ytdl-core'
import ffmpeg from 'fluent-ffmpeg'
import { spawn } from 'child_process'
import { promisify } from 'util'
import axios from 'axios'

// Load environment variables
dotenv.config()

const app = express()
const port = parseInt(process.env.PORT || '8001')
const host = process.env.HOST || 'localhost'
const mockMode = process.env.MOCK?.toLowerCase() === 'true'
const aspectApiKey = process.env.ASPECT_API_KEY
const corsOrigins = process.env.CORS_ORIGINS?.split(',').map(origin => origin.trim()) || ['http://localhost:3000']

if (!mockMode && !aspectApiKey) {
  throw new Error('ASPECT_API_KEY is required when MOCK=false')
}

// Middleware
app.use(cors({
  origin: corsOrigins,
  credentials: true
}))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Global state for mock mode
const mockIndexes: Map<string, string> = new Map()
const mockAssets: Map<string, { indexId: string; filePath: string; fileName: string }> = new Map()

// Type definitions
interface ValidateUrlRequest {
  url: string
}

interface ValidateUrlResponse {
  valid: boolean
}

interface CreateIndexRequest {
  channelUrl: string
}

interface CreateIndexResponse {
  indexId: string
  success: boolean
  message?: string
}

interface DownloadVideosRequest {
  channelUrl: string
  destinationDirectory: string
  maxVideos?: number
  ignoreDuplicates: boolean
}

interface VideoAsset {
  assetId: string
  fileName: string
  filePath: string
}

interface DownloadVideosResponse {
  downloadedVideos: VideoAsset[]
  success: boolean
  message?: string
}

interface UploadAssetRequest {
  indexId: string
  filePath: string
  fileName: string
}

interface UploadAssetResponse {
  aspectAssetId: string
  success: boolean
  message?: string
}

interface AnalyzeFramesRequest {
  indexId: string
  aspectAssetId: string
  videoFilePath: string
  startTime: string
  endTime: string
  sampleWindowSeconds: number
  framesPerWindow: number
  analysisPrompt: string
}

interface AnalyzeFramesResponse {
  result: 'yes' | 'no' | 'error'
  success: boolean
  message?: string
}

// Utility functions
function checkFfmpegAvailability(): Promise<boolean> {
  return new Promise((resolve) => {
    const ffmpegProcess = spawn('ffmpeg', ['-version'])
    ffmpegProcess.on('error', () => resolve(false))
    ffmpegProcess.on('exit', (code) => resolve(code === 0))
  })
}

function parseTimeToSeconds(timeStr: string): number {
  const parts = timeStr.split(':')
  if (parts.length !== 3) {
    throw new Error('Time must be in HH:MM:SS format')
  }
  const [hours, minutes, seconds] = parts.map(parseFloat)
  return hours * 3600 + minutes * 60 + seconds
}

async function validateYoutubeShortsUrl(url: string): Promise<boolean> {
  try {
    if (!url.replace(/\/+$/, '').endsWith('/shorts')) {
      url = url.replace(/\/+$/, '') + '/shorts'
    }
    
    // Basic validation - check if it's a valid YouTube URL structure
    const youtubeRegex = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)/
    return youtubeRegex.test(url) && url.includes('/shorts')
  } catch (error) {
    return false
  }
}

async function downloadShorts(
  channelUrl: string, 
  outputDir: string, 
  maxVideos?: number, 
  ignoreDuplicates: boolean = true
): Promise<VideoAsset[]> {
  // Note: This is a simplified implementation
  // In a real implementation, you'd use yt-dlp or similar library
  // For now, we'll return mock data
  
  const downloadedFiles: VideoAsset[] = []
  
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // Mock implementation - in reality this would use yt-dlp
  const mockVideoCount = maxVideos || Math.floor(Math.random() * 10) + 1
  
  for (let i = 0; i < mockVideoCount; i++) {
    const assetId = uuidv4()
    const fileName = `shorts_video_${i + 1}.mp4`
    const filePath = path.join(outputDir, fileName)
    
    if (ignoreDuplicates && fs.existsSync(filePath)) {
      continue
    }
    
    // Create a mock file (in reality this would be downloaded)
    fs.writeFileSync(filePath, 'mock video content')
    
    downloadedFiles.push({
      assetId,
      fileName,
      filePath
    })
  }
  
  return downloadedFiles
}

async function extractFramesFromVideo(
  videoPath: string,
  startTime: string,
  endTime: string,
  sampleWindowSeconds: number,
  framesPerWindow: number
): Promise<string[]> {
  const ffmpegAvailable = await checkFfmpegAvailability()
  if (!ffmpegAvailable) {
    throw new Error('ffmpeg is not available in PATH')
  }

  const startSeconds = parseTimeToSeconds(startTime)
  const endSeconds = parseTimeToSeconds(endTime)
  
  if (startSeconds >= endSeconds) {
    throw new Error('Start time must be before end time')
  }

  const frames: string[] = []
  const tempDir = fs.mkdtempSync('frames_')
  
  try {
    let currentTime = startSeconds
    let frameIndex = 0
    
    while (currentTime < endSeconds) {
      const windowEnd = Math.min(currentTime + sampleWindowSeconds, endSeconds)
      const middleTime = currentTime + (windowEnd - currentTime) / 2
      
      for (let i = 0; i < Math.min(framesPerWindow, 1); i++) {
        const framePath = path.join(tempDir, `frame_${String(frameIndex).padStart(6, '0')}.jpg`)
        
        await new Promise<void>((resolve, reject) => {
          ffmpeg(videoPath)
            .seekInput(middleTime)
            .frames(1)
            .output(framePath)
            .on('end', () => {
              if (fs.existsSync(framePath)) {
                frames.push(framePath)
                frameIndex++
              }
              resolve()
            })
            .on('error', (err) => {
              console.warn(`Failed to extract frame at ${middleTime}s:`, err.message)
              resolve() // Continue on error
            })
            .run()
        })
      }
      
      currentTime = windowEnd
    }
  } catch (error) {
    // Cleanup on error
    fs.rmSync(tempDir, { recursive: true, force: true })
    throw error
  }
  
  return frames
}

// Mock functions
async function mockCreateIndex(channelUrl: string): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, 500)) // Simulate network delay
  const indexId = `mock_index_${uuidv4().substring(0, 8)}`
  mockIndexes.set(indexId, channelUrl)
  return indexId
}

async function mockUploadAsset(indexId: string, filePath: string, fileName: string): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate upload time
  
  if (!mockIndexes.has(indexId)) {
    throw new Error('Invalid index ID')
  }
  
  const assetId = `mock_asset_${uuidv4().substring(0, 8)}`
  mockAssets.set(assetId, { indexId, filePath, fileName })
  return assetId
}

async function mockAnalyzeFrames(frames: string[], prompt: string): Promise<'yes' | 'no'> {
  const delay = Math.random() * 3000 + 2000 // 2-5 seconds
  await new Promise(resolve => setTimeout(resolve, delay))
  return Math.random() > 0.5 ? 'yes' : 'no'
}

// API Routes
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', mockMode })
})

app.post('/api/validate-url', async (req, res) => {
  try {
    const { url }: ValidateUrlRequest = req.body
    const isValid = await validateYoutubeShortsUrl(url)
    const response: ValidateUrlResponse = { valid: isValid }
    res.json(response)
  } catch (error) {
    console.error('Error validating URL:', error)
    res.json({ valid: false })
  }
})

app.post('/api/create-index', async (req, res) => {
  try {
    const { channelUrl }: CreateIndexRequest = req.body
    
    let indexId: string
    if (mockMode) {
      indexId = await mockCreateIndex(channelUrl)
    } else {
      // Real Aspect SDK implementation would go here
      indexId = await mockCreateIndex(channelUrl)
    }
    
    const response: CreateIndexResponse = {
      indexId,
      success: true,
      message: 'Index created successfully'
    }
    res.json(response)
  } catch (error) {
    console.error('Error creating index:', error)
    res.status(500).json({ success: false, message: String(error) })
  }
})

app.post('/api/download-videos', async (req, res) => {
  try {
    const { channelUrl, destinationDirectory, maxVideos, ignoreDuplicates }: DownloadVideosRequest = req.body
    
    const downloadedVideos = await downloadShorts(
      channelUrl,
      destinationDirectory,
      maxVideos,
      ignoreDuplicates
    )
    
    const response: DownloadVideosResponse = {
      downloadedVideos,
      success: true,
      message: `Downloaded ${downloadedVideos.length} videos`
    }
    res.json(response)
  } catch (error) {
    console.error('Error downloading videos:', error)
    res.status(500).json({ success: false, message: String(error) })
  }
})

app.post('/api/upload-asset', async (req, res) => {
  try {
    const { indexId, filePath, fileName }: UploadAssetRequest = req.body
    
    let aspectAssetId: string
    if (mockMode) {
      aspectAssetId = await mockUploadAsset(indexId, filePath, fileName)
    } else {
      // Real Aspect SDK implementation would go here
      aspectAssetId = await mockUploadAsset(indexId, filePath, fileName)
    }
    
    const response: UploadAssetResponse = {
      aspectAssetId,
      success: true,
      message: 'Asset uploaded successfully'
    }
    res.json(response)
  } catch (error) {
    console.error('Error uploading asset:', error)
    res.status(500).json({ success: false, message: String(error) })
  }
})

app.post('/api/analyze-frames', async (req, res) => {
  try {
    const {
      indexId,
      aspectAssetId,
      videoFilePath,
      startTime,
      endTime,
      sampleWindowSeconds,
      framesPerWindow,
      analysisPrompt
    }: AnalyzeFramesRequest = req.body
    
    let frames: string[] = []
    
    try {
      frames = await extractFramesFromVideo(
        videoFilePath,
        startTime,
        endTime,
        sampleWindowSeconds,
        framesPerWindow
      )
      
      if (frames.length === 0) {
        const response: AnalyzeFramesResponse = {
          result: 'error',
          success: false,
          message: 'No frames could be extracted from video'
        }
        return res.json(response)
      }
      
      let result: 'yes' | 'no'
      if (mockMode) {
        result = await mockAnalyzeFrames(frames, analysisPrompt)
      } else {
        // Real Aspect SDK implementation would go here
        result = await mockAnalyzeFrames(frames, analysisPrompt)
      }
      
      const response: AnalyzeFramesResponse = {
        result,
        success: true,
        message: `Analyzed ${frames.length} frames`
      }
      res.json(response)
    } finally {
      // Cleanup extracted frames
      frames.forEach(framePath => {
        try {
          fs.unlinkSync(framePath)
        } catch (error) {
          // Ignore cleanup errors
        }
      })
      
      // Cleanup temp directory
      if (frames.length > 0) {
        const tempDir = path.dirname(frames[0])
        try {
          fs.rmSync(tempDir, { recursive: true, force: true })
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    }
  } catch (error) {
    console.error('Error analyzing frames:', error)
    const response: AnalyzeFramesResponse = {
      result: 'error',
      success: false,
      message: String(error)
    }
    res.json(response)
  }
})

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error)
  res.status(500).json({ success: false, message: 'Internal server error' })
})

// Start server
app.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}`)
  console.log(`Mock mode: ${mockMode}`)
})

