'use client'

import React, { useState } from 'react'
import { Plus, Trash2, Edit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Spinner } from '@/components/ui/spinner'
import useAppStore from '@/store/app-store'
import { JobCreationModal } from './job-creation-modal'
import { cn } from '@/lib/utils'

export function AnalysisTable() {
  const { videoAssets, analysisJobs, removeAnalysisJob } = useAppStore()
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)

  const canAddMoreJobs = analysisJobs.length < 5

  const getCellContent = (result: string) => {
    switch (result) {
      case 'running':
        return <Spinner size="sm" />
      case 'yes':
        return <span className="text-green-600 font-medium">yes</span>
      case 'no':
        return <span className="text-red-500 font-medium">no</span>
      case 'error':
        return <span className="text-slate-600 font-medium">error</span>
      default:
        return <span className="text-muted-foreground">-</span>
    }
  }

  const handleDeleteJob = (jobId: string) => {
    removeAnalysisJob(jobId)
  }

  if (videoAssets.length === 0) {
    return null
  }

  return (
    <div className="space-y-4 p-6 max-w-full mx-auto">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">Video Asset</TableHead>
              {analysisJobs.map((job) => (
                <TableHead key={job.jobId} className="min-w-[150px]">
                  <div className="flex items-center justify-between">
                    <span className="truncate">{job.jobName}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 ml-2"
                      onClick={() => handleDeleteJob(job.jobId)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </TableHead>
              ))}
              {canAddMoreJobs && (
                <TableHead className="w-[60px]">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setIsModalOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {videoAssets.map((asset) => (
              <TableRow key={asset.assetId}>
                <TableCell className="font-medium">
                  <div className="truncate max-w-[200px]" title={asset.fileName}>
                    {asset.fileName}
                  </div>
                </TableCell>
                {analysisJobs.map((job) => (
                  <TableCell key={job.jobId}>
                    {getCellContent(asset.jobResults[job.jobId] || 'pending')}
                  </TableCell>
                ))}
                {canAddMoreJobs && (
                  <TableCell />
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <JobCreationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  )
}