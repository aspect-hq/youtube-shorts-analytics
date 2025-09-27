import axios from 'axios'


const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface CreateIndexRequest {
  channelUrl: string
}

export interface CreateIndexResponse {
  indexId: string
  success: boolean
  message?: string
}

export interface DownloadVideosRequest {
  channelUrl: string
  destinationDirectory: string
  maxVideos?: number
  ignoreDuplicates: boolean
}

export interface DownloadVideosResponse {
  downloadedVideos: Array<{
    assetId: string
    fileName: string
    filePath: string
  }>
  success: boolean
  message?: string
}

export interface UploadAssetRequest {
  indexId: string
  filePath: string
  fileName: string
}

export interface UploadAssetResponse {
  aspectAssetId: string
  success: boolean
  message?: string
}

export interface AnalyzeFramesRequest {
  indexId: string
  aspectAssetId: string
  videoFilePath: string
  startTime: string
  endTime: string
  sampleWindowSeconds: number
  framesPerWindow: number
  analysisPrompt: string
}

export interface AnalyzeFramesResponse {
  result: 'yes' | 'no' | 'error'
  success: boolean
  message?: string
}

class ApiClient {
  private axiosInstance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  })

  async validateYoutubeUrl(url: string): Promise<boolean> {
    try {
      const response = await this.axiosInstance.post('/api/validate-url', { url })
      return response.data.valid
    } catch {
      return false
    }
  }

  async createIndex(request: CreateIndexRequest): Promise<CreateIndexResponse> {
    const response = await this.axiosInstance.post('/api/create-index', request)
    return response.data
  }

  async downloadVideos(request: DownloadVideosRequest): Promise<DownloadVideosResponse> {
    const response = await this.axiosInstance.post('/api/download-videos', request)
    return response.data
  }

  async uploadAsset(request: UploadAssetRequest): Promise<UploadAssetResponse> {
    const response = await this.axiosInstance.post('/api/upload-asset', request)
    return response.data
  }

  async analyzeFrames(request: AnalyzeFramesRequest): Promise<AnalyzeFramesResponse> {
    const response = await this.axiosInstance.post('/api/analyze-frames', request)
    return response.data
  }
}

export const apiClient = new ApiClient()
