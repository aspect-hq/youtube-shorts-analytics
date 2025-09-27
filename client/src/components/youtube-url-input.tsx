'use client'

import React, { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import useAppStore from '@/store/app-store'
import { apiClient } from '@/lib/api-client'

export function YoutubeUrlInput() {
  const {
    youtubeUrl,
    isValidUrl,
    destinationDirectory,
    maxVideosToScrape,
    ignoreDuplicates,
    setYoutubeUrl,
    setIsValidUrl,
    setDestinationDirectory,
    setMaxVideosToScrape,
    setIgnoreDuplicates,
    setAspectIndexId,
    addVideoAsset,
    setDownloadProgress
  } = useAppStore()

  const [isValidating, setIsValidating] = useState<boolean>(false)
  const [isDownloading, setIsDownloading] = useState<boolean>(false)

  const handleUrlSubmit = async () => {
    if (!youtubeUrl.trim()) return

    setIsValidating(true)
    try {
      const isValid = await apiClient.validateYoutubeUrl(youtubeUrl)
      setIsValidUrl(isValid)
      
      if (isValid) {
        const indexResponse = await apiClient.createIndex({ channelUrl: youtubeUrl })
        if (indexResponse.success) {
          setAspectIndexId(indexResponse.indexId)
        }
      }
    } catch (error) {
      console.error('Error validating URL:', error)
      setIsValidUrl(false)
    } finally {
      setIsValidating(false)
    }
  }

  const handleDownloadVideos = async () => {
    if (!isValidUrl || !destinationDirectory.trim()) return

    setIsDownloading(true)
    try {
      const downloadResponse = await apiClient.downloadVideos({
        channelUrl: youtubeUrl,
        destinationDirectory,
        maxVideos: maxVideosToScrape || undefined,
        ignoreDuplicates
      })

      if (downloadResponse.success) {
        downloadResponse.downloadedVideos.forEach(video => {
          addVideoAsset({
            assetId: video.assetId,
            fileName: video.fileName,
            filePath: video.filePath,
            jobResults: {}
          })
          setDownloadProgress(video.assetId, 'complete')
        })
      }
    } catch (error) {
      console.error('Error downloading videos:', error)
    } finally {
      setIsDownloading(false)
    }
  }

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleUrlSubmit()
    }
  }

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="youtube-url">YouTube Shorts Channel URL</Label>
          <div className="flex gap-2">
            <Input
              id="youtube-url"
              type="url"
              placeholder="https://www.youtube.com/@channel/shorts"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
            />
            <Button 
              onClick={handleUrlSubmit}
              disabled={isValidating || !youtubeUrl.trim()}
            >
              {isValidating ? 'Validating...' : 'Validate'}
            </Button>
          </div>
          {isValidUrl && (
            <p className="text-sm text-green-600">Valid YouTube Shorts channel URL</p>
          )}
          {youtubeUrl && !isValidUrl && !isValidating && (
            <p className="text-sm text-red-500">Invalid YouTube Shorts channel URL</p>
          )}
        </div>

        {isValidUrl && (
          <div className="space-y-4 border-t pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="destination">Destination Directory</Label>
                <Input
                  id="destination"
                  type="text"
                  placeholder="/path/to/download/directory"
                  value={destinationDirectory}
                  onChange={(e) => setDestinationDirectory(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-videos">Max Videos (blank = all)</Label>
                <Input
                  id="max-videos"
                  type="number"
                  min="1"
                  placeholder="Leave blank for all"
                  value={maxVideosToScrape || ''}
                  onChange={(e) => setMaxVideosToScrape(e.target.value ? parseInt(e.target.value) : null)}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="ignore-duplicates"
                checked={ignoreDuplicates}
                onCheckedChange={(checked) => setIgnoreDuplicates(checked as boolean)}
              />
              <Label htmlFor="ignore-duplicates">Ignore duplicates (skip files that already exist)</Label>
            </div>

            <Button 
              onClick={handleDownloadVideos}
              disabled={isDownloading || !destinationDirectory.trim()}
              className="w-full"
            >
              {isDownloading ? 'Downloading...' : 'Download Videos'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
