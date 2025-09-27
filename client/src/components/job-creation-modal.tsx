'use client'

import React, { useState } from 'react'
import { Edit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import useAppStore from '@/store/app-store'
import { apiClient } from '@/lib/api-client'

interface JobCreationModalProps {
  isOpen: boolean
  onClose: () => void
}

export function JobCreationModal({ isOpen, onClose }: JobCreationModalProps) {
  const { 
    addAnalysisJob, 
    videoAssets, 
    aspectIndexId,
    updateJobResult 
  } = useAppStore()

  const [jobName, setJobName] = useState<string>('New Analysis Job')
  const [isEditingName, setIsEditingName] = useState<boolean>(false)
  const [videoStartTime, setVideoStartTime] = useState<string>('00:00:00')
  const [videoEndTime, setVideoEndTime] = useState<string>('00:00:30')
  const [sampleWindowSeconds, setSampleWindowSeconds] = useState<number>(2)
  const [framesPerWindow, setFramesPerWindow] = useState<number>(1)
  const [analysisPrompt, setAnalysisPrompt] = useState<string>('')
  const [isCreating, setIsCreating] = useState<boolean>(false)

  const handleClose = () => {
    setJobName('New Analysis Job')
    setIsEditingName(false)
    setVideoStartTime('00:00:00')
    setVideoEndTime('00:00:30')
    setSampleWindowSeconds(2)
    setFramesPerWindow(1)
    setAnalysisPrompt('')
    setIsCreating(false)
    onClose()
  }

  const validateTimeFormat = (time: string): boolean => {
    const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])$/
    return timeRegex.test(time)
  }

  const handleCreateJob = async () => {
    if (!jobName.trim() || !analysisPrompt.trim()) return
    if (!validateTimeFormat(videoStartTime) || !validateTimeFormat(videoEndTime)) return
    if (sampleWindowSeconds <= 0 || framesPerWindow <= 0 || framesPerWindow > 10) return
    if (!aspectIndexId) return

    setIsCreating(true)

    try {
      const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      const newJob = {
        jobId,
        jobName: jobName.trim(),
        videoStartTime,
        videoEndTime,
        sampleWindowSeconds,
        framesPerWindow,
        analysisPrompt: analysisPrompt.trim()
      }

      addAnalysisJob(newJob)
      handleClose()

      // Start processing assets for this job
      for (const asset of videoAssets) {
        if (!asset.aspectAssetId) {
          // Upload asset to Aspect first
          try {
            const uploadResponse = await apiClient.uploadAsset({
              indexId: aspectIndexId,
              filePath: asset.filePath,
              fileName: asset.fileName
            })
            
            if (uploadResponse.success) {
              asset.aspectAssetId = uploadResponse.aspectAssetId
            } else {
              updateJobResult(asset.assetId, jobId, 'error')
              continue
            }
          } catch (error) {
            console.error('Error uploading asset:', error)
            updateJobResult(asset.assetId, jobId, 'error')
            continue
          }
        }

        // Set status to running
        updateJobResult(asset.assetId, jobId, 'running')

        try {
          const analysisResponse = await apiClient.analyzeFrames({
            indexId: aspectIndexId,
            aspectAssetId: asset.aspectAssetId!,
            videoFilePath: asset.filePath,
            startTime: videoStartTime,
            endTime: videoEndTime,
            sampleWindowSeconds,
            framesPerWindow,
            analysisPrompt: `${analysisPrompt.trim()} Only respond with a yes or no. If the answer is ambiguous, respond with no.`
          })

          if (analysisResponse.success) {
            updateJobResult(asset.assetId, jobId, analysisResponse.result)
          } else {
            updateJobResult(asset.assetId, jobId, 'error')
          }
        } catch (error) {
          console.error('Error analyzing frames:', error)
          updateJobResult(asset.assetId, jobId, 'error')
        }
      }
    } catch (error) {
      console.error('Error creating job:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const isFormValid = 
    jobName.trim() && 
    analysisPrompt.trim() && 
    validateTimeFormat(videoStartTime) && 
    validateTimeFormat(videoEndTime) &&
    sampleWindowSeconds > 0 && 
    framesPerWindow > 0 && 
    framesPerWindow <= 10

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Analysis Job</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Job Name</Label>
            <div className="flex items-center gap-2">
              {isEditingName ? (
                <Input
                  value={jobName}
                  onChange={(e) => setJobName(e.target.value)}
                  onBlur={() => setIsEditingName(false)}
                  onKeyPress={(e) => e.key === 'Enter' && setIsEditingName(false)}
                  autoFocus
                />
              ) : (
                <>
                  <span className="flex-1 text-sm">{jobName}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setIsEditingName(true)}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-time">Start Time (HH:MM:SS)</Label>
              <Input
                id="start-time"
                value={videoStartTime}
                onChange={(e) => setVideoStartTime(e.target.value)}
                placeholder="00:00:00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-time">End Time (HH:MM:SS)</Label>
              <Input
                id="end-time"
                value={videoEndTime}
                onChange={(e) => setVideoEndTime(e.target.value)}
                placeholder="00:00:30"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sample-window">Sample Window (seconds)</Label>
            <Input
              id="sample-window"
              type="number"
              min="1"
              value={sampleWindowSeconds}
              onChange={(e) => setSampleWindowSeconds(parseInt(e.target.value) || 1)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="frames-per-window">Frames per Sample Window (max 10)</Label>
            <Input
              id="frames-per-window"
              type="number"
              min="1"
              max="10"
              value={framesPerWindow}
              onChange={(e) => setFramesPerWindow(parseInt(e.target.value) || 1)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="analysis-prompt">Does the video contain</Label>
            <Input
              id="analysis-prompt"
              value={analysisPrompt}
              onChange={(e) => setAnalysisPrompt(e.target.value)}
              placeholder="e.g., a person dancing, a product showcase..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateJob}
            disabled={!isFormValid || isCreating}
          >
            {isCreating ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
