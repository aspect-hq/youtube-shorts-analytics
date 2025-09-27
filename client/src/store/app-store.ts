import { create } from 'zustand'

interface VideoAsset {
  assetId: string
  fileName: string
  filePath: string
  aspectAssetId?: string
  jobResults: Record<string, 'pending' | 'running' | 'yes' | 'no' | 'error'>
}

interface AnalysisJob {
  jobId: string
  jobName: string
  videoStartTime: string
  videoEndTime: string
  sampleWindowSeconds: number
  framesPerWindow: number
  analysisPrompt: string
}

interface AppState {
  // YouTube URL and validation
  youtubeUrl: string
  isValidUrl: boolean
  destinationDirectory: string
  maxVideosToScrape: number | null
  ignoreDuplicates: boolean
  
  // Aspect index
  aspectIndexId: string | null
  
  // Video assets
  videoAssets: VideoAsset[]
  downloadProgress: Record<string, 'pending' | 'downloading' | 'complete' | 'error'>
  
  // Analysis jobs
  analysisJobs: AnalysisJob[]
  
  // Actions
  setYoutubeUrl: (url: string) => void
  setIsValidUrl: (valid: boolean) => void
  setDestinationDirectory: (dir: string) => void
  setMaxVideosToScrape: (max: number | null) => void
  setIgnoreDuplicates: (ignore: boolean) => void
  setAspectIndexId: (indexId: string) => void
  addVideoAsset: (asset: VideoAsset) => void
  updateVideoAsset: (assetId: string, updates: Partial<VideoAsset>) => void
  setDownloadProgress: (assetId: string, status: 'pending' | 'downloading' | 'complete' | 'error') => void
  addAnalysisJob: (job: AnalysisJob) => void
  removeAnalysisJob: (jobId: string) => void
  updateJobResult: (assetId: string, jobId: string, result: 'running' | 'yes' | 'no' | 'error') => void
  resetSession: () => void
}

const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  youtubeUrl: '',
  isValidUrl: false,
  destinationDirectory: '',
  maxVideosToScrape: null,
  ignoreDuplicates: true,
  aspectIndexId: null,
  videoAssets: [],
  downloadProgress: {},
  analysisJobs: [],
  
  // Actions
  setYoutubeUrl: (url: string) => set({ youtubeUrl: url }),
  setIsValidUrl: (valid: boolean) => set({ isValidUrl: valid }),
  setDestinationDirectory: (dir: string) => set({ destinationDirectory: dir }),
  setMaxVideosToScrape: (max: number | null) => set({ maxVideosToScrape: max }),
  setIgnoreDuplicates: (ignore: boolean) => set({ ignoreDuplicates: ignore }),
  setAspectIndexId: (indexId: string) => set({ aspectIndexId: indexId }),
  
  addVideoAsset: (asset: VideoAsset) => set((state) => ({
    videoAssets: [...state.videoAssets, asset]
  })),
  
  updateVideoAsset: (assetId: string, updates: Partial<VideoAsset>) => set((state) => ({
    videoAssets: state.videoAssets.map(asset => 
      asset.assetId === assetId ? { ...asset, ...updates } : asset
    )
  })),
  
  setDownloadProgress: (assetId: string, status: 'pending' | 'downloading' | 'complete' | 'error') => set((state) => ({
    downloadProgress: { ...state.downloadProgress, [assetId]: status }
  })),
  
  addAnalysisJob: (job: AnalysisJob) => set((state) => {
    const newJobs = [...state.analysisJobs, job]
    const updatedAssets = state.videoAssets.map(asset => ({
      ...asset,
      jobResults: { ...asset.jobResults, [job.jobId]: 'pending' as const }
    }))
    return { analysisJobs: newJobs, videoAssets: updatedAssets }
  }),
  
  removeAnalysisJob: (jobId: string) => set((state) => {
    const filteredJobs = state.analysisJobs.filter(job => job.jobId !== jobId)
    const updatedAssets = state.videoAssets.map(asset => {
      const { [jobId]: removed, ...remainingResults } = asset.jobResults
      return { ...asset, jobResults: remainingResults }
    })
    return { analysisJobs: filteredJobs, videoAssets: updatedAssets }
  }),
  
  updateJobResult: (assetId: string, jobId: string, result: 'running' | 'yes' | 'no' | 'error') => set((state) => ({
    videoAssets: state.videoAssets.map(asset => 
      asset.assetId === assetId 
        ? { ...asset, jobResults: { ...asset.jobResults, [jobId]: result } }
        : asset
    )
  })),
  
  resetSession: () => set({
    youtubeUrl: '',
    isValidUrl: false,
    destinationDirectory: '',
    maxVideosToScrape: null,
    ignoreDuplicates: true,
    aspectIndexId: null,
    videoAssets: [],
    downloadProgress: {},
    analysisJobs: [],
  })
}))

export default useAppStore
