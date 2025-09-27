# YouTube Shorts Analytics

A full-stack application for analyzing YouTube Shorts videos using the Aspect SDK. This project includes a React frontend and two interchangeable backend implementations (Python FastAPI and Node.js Express).

## Features

- **YouTube Shorts Download**: Validate and download videos from YouTube Shorts channels
- **Video Analysis**: Extract frames and analyze them using the Aspect SDK
- **Dual Backend Support**: Choose between Python (FastAPI) or Node.js (Express) backends
- **Real-time Progress**: Track download and analysis progress
- **Configurable Analysis**: Set custom time ranges, sampling windows, and analysis prompts

## Prerequisites

- **Node.js** >= 18.0.0 and **yarn** for the frontend
- **Python** >= 3.11 and **uv** for the Python backend (if using)
- **FFmpeg** installed and available in your PATH
- **Aspect API Key**

### Installing FFmpeg

**macOS (Homebrew):**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install ffmpeg
```

**Windows:**
Download from [https://ffmpeg.org/download.html](https://ffmpeg.org/download.html) and add to PATH.

## Getting Your API Key

1. Log into the [Aspect Dashboard](https://playground.aspect.inc/api-keys)
2. Navigate to **API Keys** in the left sidebar
3. Click **Create New API Key**
4. Give your key a descriptive name
5. Copy the key (it will only be shown once!)

## Quick Start

### 1. Clone and Setup

```bash
git clone <repository-url>
cd youtube-shorts-analytics
```

### 2. Frontend Setup

```bash
cd client
yarn install
```

### 3. Backend Setup (Choose One)

#### Option A: Python Backend (FastAPI)

```bash
cd server-python
cp env.example .env
# Edit .env with your configuration
uv sync
```

#### Option B: Node.js Backend (Express)

```bash
cd server-node
cp env.example .env
# Edit .env with your configuration
yarn install
```

### 4. Environment Configuration

Edit the `.env` file in your chosen backend directory:

```bash
# Required: Your Aspect API key
ASPECT_API_KEY=your_aspect_api_key_here

# Optional: Server configuration
HOST=localhost
PORT=8000  # 8000 for Python, 8001 for Node.js
DEBUG=true
```

### 5. Start the Application

#### Start the Frontend
```bash
cd client
yarn dev
```
The frontend will be available at [http://localhost:3000](http://localhost:3000)

#### Start Your Chosen Backend

**Python Backend:**
```bash
cd server-python
uv run python -m uvicorn main:app --reload --host localhost --port 8000
```

**Node.js Backend:**
```bash
cd server-node
yarn dev
```

## Usage

1. **Enter a YouTube Shorts URL**: Paste a YouTube Shorts channel URL (e.g., `https://www.youtube.com/@channel/shorts`)
2. **Configure Download Settings**: 
   - Set destination directory for downloaded videos
   - Optionally limit the number of videos to download
   - Choose whether to ignore duplicate files
3. **Download Videos**: Click "Download Videos" to fetch Shorts from the channel
4. **Create Analysis Jobs**: 
   - Click the "+" button to create a new analysis job
   - Set video time range (HH:MM:SS format)
   - Configure frame sampling (window size and frames per window)
   - Enter your analysis prompt (e.g., "a person dancing")
5. **View Results**: Results appear in the table as "yes", "no", or "error"

## API Endpoints

Both backends expose the same REST API:

- `POST /api/validate-url` - Validate YouTube Shorts URL
- `POST /api/create-index` - Create Aspect index
- `POST /api/download-videos` - Download videos from channel
- `POST /api/upload-asset` - Upload video to Aspect
- `POST /api/analyze-frames` - Analyze video frames


## Development

### Frontend Development
```bash
cd client
yarn dev          # Start development server
yarn build        # Build for production
yarn lint         # Run linter
```

### Python Backend Development
```bash
cd server-python
uv run python -m uvicorn main:app --reload  # Start with auto-reload
```

### Node.js Backend Development
```bash
cd server-node
yarn dev          # Start with auto-reload using tsx
yarn build        # Build TypeScript
yarn start        # Start production build
```

## Project Structure

```
youtube-shorts-analytics/
├── client/                 # React frontend (Next.js)
│   ├── src/
│   │   ├── app/           # Next.js app router
│   │   ├── components/    # React components
│   │   ├── lib/          # Utilities and API client
│   │   └── store/        # Zustand state management
│   └── package.json
├── server-python/         # Python backend (FastAPI)
│   ├── main.py           # FastAPI application
│   ├── pyproject.toml    # Python dependencies
│   └── env.example
├── server-node/          # Node.js backend (Express)
│   ├── src/
│   │   └── index.ts      # Express application
│   ├── package.json      # Node.js dependencies
│   └── env.example
└── README.md
```

## Troubleshooting

### FFmpeg Not Found
Ensure FFmpeg is installed and available in your PATH:
```bash
ffmpeg -version
```


### Port Conflicts
- Frontend runs on port 3000
- Python backend defaults to port 8000
- Node.js backend defaults to port 8001
- Modify the `PORT` environment variable if needed

### CORS Issues
Update `CORS_ORIGINS` in your backend's `.env` file if accessing from a different origin.

## License

MIT License - see LICENSE file for details.
