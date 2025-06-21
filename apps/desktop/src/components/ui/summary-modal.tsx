import { useState } from 'react'
import { Button } from './button'
import { Badge } from './badge'
import { X, Copy, CheckCircle, AlertCircle, Bot, Clock } from 'lucide-react'

interface SummaryModalProps {
  isOpen: boolean
  onClose: () => void
  summary: string | null
  sessionInfo?: {
    id: string
    startTime: string
    endTime?: string
    messageCount: number
  }
  isLoading?: boolean
  error?: string | null
}

export function SummaryModal({ 
  isOpen, 
  onClose, 
  summary, 
  sessionInfo, 
  isLoading = false, 
  error = null 
}: SummaryModalProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (summary) {
      try {
        await navigator.clipboard.writeText(summary)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (error) {
        console.error('Failed to copy to clipboard:', error)
      }
    }
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
  }

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime)
    const end = endTime ? new Date(endTime) : new Date()
    const duration = Math.round((end.getTime() - start.getTime()) / 1000 / 60) // minutes
    return `${duration} min`
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg shadow-lg max-w-3xl w-full mx-4 max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-2">
            <Bot className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold">AI Summary</h2>
            {sessionInfo && (
              <Badge variant="outline" className="ml-2">
                {sessionInfo.messageCount} messages
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {sessionInfo && (
            <div className="mb-6 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <Clock className="w-4 h-4" />
                  <span>Session: {formatTimestamp(sessionInfo.startTime)}</span>
                </div>
                <span>•</span>
                <span>Duration: {formatDuration(sessionInfo.startTime, sessionInfo.endTime)}</span>
                <span>•</span>
                <span>{sessionInfo.messageCount} messages</span>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-muted-foreground">AI is analyzing your notifications...</p>
              <p className="text-sm text-muted-foreground">This may take a moment for longer conversations</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start space-x-2 text-destructive">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Failed to generate summary</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
          )}

          {summary && !isLoading && !error && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Summary</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="flex items-center space-x-1"
                >
                  {copied ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>
              </div>

              <div className="prose prose-sm max-w-none dark:prose-invert">
                <div className="p-4 bg-muted/30 rounded-lg border border-border">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {summary}
                  </div>
                </div>
              </div>

              <div className="text-xs text-muted-foreground flex items-center space-x-1 mt-4">
                <Bot className="w-3 h-3" />
                <span>Generated by AI • Review for accuracy</span>
              </div>
            </div>
          )}

          {!summary && !isLoading && !error && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4 text-muted-foreground">
              <Bot className="w-12 h-12" />
              <p>No summary available</p>
              <p className="text-sm">Try generating a summary for this session</p>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center p-6 border-t border-border">
          <div className="text-xs text-muted-foreground">
            {summary && `Summary length: ${summary.length} characters`}
          </div>
          
          <div className="flex space-x-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
} 