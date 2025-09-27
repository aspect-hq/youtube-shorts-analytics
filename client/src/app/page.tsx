'use client'

import { YoutubeUrlInput } from '@/components/youtube-url-input'
import { AnalysisTable } from '@/components/analysis-table'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">YouTube Shorts Analytics</h1>
            <p className="text-muted-foreground">
              Analyze YouTube Shorts videos using the Aspect SDK
            </p>
          </div>
          
          <YoutubeUrlInput />
          <AnalysisTable />
        </div>
      </div>
    </main>
  )
}
