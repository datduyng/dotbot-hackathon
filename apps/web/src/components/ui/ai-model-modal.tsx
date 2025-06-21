import React, { useState, useEffect } from 'react'
import { X, Download, Check, Loader2, Bot, Cloud, HardDrive, Settings, Key, Eye, EyeOff } from 'lucide-react'
import { Button } from './button'
import { Badge } from './badge'
import { Label } from './label'
import { RadioGroup, RadioGroupItem } from './radio-group'

// Use the DownloadProgress type from electron-env.d.ts
type DownloadProgress = {
  progress: number
  loaded: number
  total: number
  status: string
}

interface AIModelInfo {
  name: string
  modelId: string
  sizeDescription: string
  isDownloaded: boolean
  downloadProgress?: number
}

interface AIModelModalProps {
  isOpen: boolean
  onClose: () => void
  onModelSelected: (modelId: string) => void
}

export function AIModelModal({ isOpen, onClose, onModelSelected }: AIModelModalProps) {
  const [models, setModels] = useState<AIModelInfo[]>([])
  const [currentModel, setCurrentModel] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [downloadProgress, setDownloadProgress] = useState<Record<string, DownloadProgress>>({})
  const [downloadingModels, setDownloadingModels] = useState<Set<string>>(new Set())
  const [aiMode, setAIMode] = useState<'local' | 'remote'>('remote')
  const [downloadedModels, setDownloadedModels] = useState<string[]>([])
  const [apiKey, setApiKey] = useState<string>('')
  const [showApiKey, setShowApiKey] = useState<boolean>(false)
  const [apiKeyStatus, setApiKeyStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  useEffect(() => {
    if (isOpen) {
      loadData()
      
      // Listen for download progress
      const handleDownloadProgress = (data: { sessionId: string; progress: DownloadProgress }) => {
        // Ensure progress is defined before setting state
        setDownloadProgress(prev => ({
          ...prev,
          [data.sessionId]: data.progress
        }))
      }

      window.electronAPI.onAIDownloadProgress(handleDownloadProgress as any)

      return () => {
        window.electronAPI.removeAIListeners()
      }
    }
  }, [isOpen])

  const loadData = async () => {
    try {
      setIsLoading(true)
      const [modelsData, currentModelData, modeData, downloadedData, storedApiKey] = await Promise.all([
        window.electronAPI.getAvailableAIModels(),
        window.electronAPI.getCurrentAIModel(),
        window.electronAPI.getAIMode(),
        window.electronAPI.getDownloadedAIModels(),
        window.electronAPI.getAIGatewayApiKey()
      ])
      
      setModels(modelsData)
      setCurrentModel(currentModelData)
      setAIMode(modeData)
      setDownloadedModels(downloadedData)
      setApiKey(storedApiKey || '')
    } catch (error) {
      console.error('Failed to load AI models data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleModeChange = async (mode: 'local' | 'remote') => {
    try {
      await window.electronAPI.setAIMode(mode)
      setAIMode(mode)
    } catch (error) {
      console.error('Failed to set AI mode:', error)
    }
  }

  const handleDownloadModel = async (modelId: string) => {
    const sessionId = `download-${Date.now()}`
    setDownloadingModels(prev => new Set(prev).add(modelId))
    
    try {
      const success = await window.electronAPI.downloadAIModel(modelId, sessionId)
      
      if (success) {
        // Refresh data to update download status
        await loadData()
      }
    } catch (error) {
      console.error('Failed to download model:', error)
    } finally {
      setDownloadingModels(prev => {
        const newSet = new Set(prev)
        newSet.delete(modelId)
        return newSet
      })
      
      // Clean up progress
      setDownloadProgress(prev => {
        const newProgress = { ...prev }
        delete newProgress[sessionId]
        return newProgress
      })
    }
  }

  const handleLoadModel = async (modelId: string) => {
    try {
      await window.electronAPI.loadAIModel(modelId)
      setCurrentModel(modelId)
      onModelSelected(modelId)
    } catch (error) {
      console.error('Failed to load model:', error)
    }
  }

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) return
    
    try {
      setApiKeyStatus('saving')
      const success = await window.electronAPI.setAIGatewayApiKey(apiKey.trim())
      
      if (success) {
        setApiKeyStatus('saved')
        setTimeout(() => setApiKeyStatus('idle'), 2000)
      } else {
        setApiKeyStatus('error')
        setTimeout(() => setApiKeyStatus('idle'), 3000)
      }
    } catch (error) {
      console.error('Failed to save API key:', error)
      setApiKeyStatus('error')
      setTimeout(() => setApiKeyStatus('idle'), 3000)
    }
  }

  const handleClearApiKey = async () => {
    try {
      await window.electronAPI.clearAIGatewayApiKey()
      setApiKey('')
      setApiKeyStatus('idle')
    } catch (error) {
      console.error('Failed to clear API key:', error)
    }
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getProgressForModel = (modelId: string): DownloadProgress | null => {
    if (!models || !downloadProgress) return null
    
    const sessionId = Object.keys(downloadProgress).find(id => {
      const progress = downloadProgress[id]
      const modelName = models.find(m => m.modelId === modelId)?.name || ''
      return progress && progress.status && progress.status.includes(modelName)
    })
    return sessionId ? downloadProgress[sessionId] : null
  }

  if (!isOpen) return null

  return (
    <div className="flex fixed inset-0 z-50 justify-center items-center bg-black bg-opacity-50">
      <div className="bg-background border border-border rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-border">
          <div className="flex items-center space-x-2">
            <Bot className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold">AI Models</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="p-0 w-8 h-8"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* AI Mode Selection */}
          <div className="mb-6">
            <Label className="block mb-3 text-base font-semibold">AI Processing Mode</Label>
            <RadioGroup
              value={aiMode}
              onValueChange={(value: 'local' | 'remote') => handleModeChange(value)}
              className="space-y-3"
            >
              <div className="flex items-center p-3 space-x-3 rounded-lg border border-border">
                <RadioGroupItem value="remote" id="remote" />
                <div className="flex flex-1 items-center space-x-2">
                  <Cloud className="w-4 h-4 text-blue-500" />
                  <div>
                    <Label htmlFor="remote" className="font-medium">Remote AI (Cloud)</Label>
                    <p className="text-sm text-muted-foreground">Fast, always available, requires internet</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center p-3 space-x-3 rounded-lg border border-border">
                <RadioGroupItem value="local" id="local" />
                <div className="flex flex-1 items-center space-x-2">
                  <HardDrive className="w-4 h-4 text-green-500" />
                  <div>
                    <Label htmlFor="local" className="font-medium">Local AI (On-device)</Label>
                    <p className="text-sm text-muted-foreground">Private, works offline, requires model download</p>
                  </div>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Local Models Section */}
          {aiMode === 'local' && (
            <div>
              <div className="flex items-center mb-4 space-x-2">
                <Settings className="w-5 h-5" />
                <Label className="text-base font-semibold">Available Local Models</Label>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-3">
                  {models?.length > 0 ? models.map((model) => {
                    const isDownloading = downloadingModels.has(model.modelId)
                    const progress = getProgressForModel(model.modelId)
                    const isDownloaded = downloadedModels?.includes(model.modelId) || false
                    const isCurrent = currentModel === model.modelId

                    return (
                      <div key={model.modelId} className="p-4 rounded-lg border border-border">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center mb-1 space-x-2">
                              <h3 className="font-semibold">{model.name}</h3>
                              {isCurrent && (
                                <Badge variant="default" className="text-xs">Current</Badge>
                              )}
                              {isDownloaded && !isCurrent && (
                                <Badge variant="secondary" className="text-xs">Downloaded</Badge>
                              )}
                            </div>
                            <p className="mb-2 text-sm text-muted-foreground">
                              {model.sizeDescription}
                            </p>
                            
                            {progress && (
                              <div className="mb-2">
                                <div className="flex justify-between mb-1 text-xs text-muted-foreground">
                                  <span>{progress.status}</span>
                                  <span>{progress.progress}%</span>
                                </div>
                                <div className="w-full h-2 rounded-full bg-muted">
                                  <div 
                                    className="h-2 rounded-full transition-all duration-300 bg-primary" 
                                    style={{ width: `${progress.progress}%` }}
                                  />
                                </div>
                                {progress.loaded && progress.total && (
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    {formatBytes(progress.loaded)} / {formatBytes(progress.total)}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex ml-4 space-x-2">
                            {!isDownloaded && !isDownloading && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownloadModel(model.modelId)}
                                className="flex items-center space-x-1"
                              >
                                <Download className="w-3 h-3" />
                                <span>Download</span>
                              </Button>
                            )}
                            
                            {isDownloading && (
                              <Button variant="outline" size="sm" disabled>
                                <Loader2 className="mr-1 w-3 h-3 animate-spin" />
                                Downloading
                              </Button>
                            )}
                            
                            {isDownloaded && !isCurrent && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleLoadModel(model.modelId)}
                                className="flex items-center space-x-1"
                              >
                                <Check className="w-3 h-3" />
                                <span>Load</span>
                              </Button>
                            )}
                            
                            {isCurrent && (
                              <Button variant="default" size="sm" disabled>
                                <Check className="mr-1 w-3 h-3" />
                                Active
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  }) : (
                    <div className="py-4 text-center">
                      <p className="text-muted-foreground">No models available</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Remote Mode Info */}
          {aiMode === 'remote' && (
            <div>
              <div className="flex items-center mb-4 space-x-2">
                <Key className="w-5 h-5" />
                <Label className="text-base font-semibold">AI Gateway API Key</Label>
              </div>
              
              <div className="mb-6">
                <div className="flex items-center mb-3 space-x-2">
                  <div className="flex flex-1">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Enter your AI Gateway API key..."
                      className="flex px-3 py-2 w-full h-10 text-sm rounded-md border border-input bg-background ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="px-3 ml-2"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <div className="flex space-x-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleSaveApiKey}
                      disabled={!apiKey.trim() || apiKeyStatus === 'saving'}
                      className="flex items-center space-x-1"
                    >
                      {apiKeyStatus === 'saving' ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : apiKeyStatus === 'saved' ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Key className="w-3 h-3" />
                      )}
                      <span>
                        {apiKeyStatus === 'saving' ? 'Saving...' : 
                         apiKeyStatus === 'saved' ? 'Saved!' : 
                         'Save API Key'}
                      </span>
                    </Button>
                    
                    {apiKey && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleClearApiKey}
                        className="flex items-center space-x-1"
                      >
                        <X className="w-3 h-3" />
                        <span>Clear</span>
                      </Button>
                    )}
                  </div>
                  
                  {apiKeyStatus === 'error' && (
                    <span className="text-sm text-red-500">Failed to save API key</span>
                  )}
                </div>
                
                <p className="mt-2 text-xs text-muted-foreground">
                  Your API key is stored locally and encrypted. It's used to authenticate with the AI Gateway service.
                </p>
              </div>

              <div className="py-4 text-center border-t border-border">
                <Cloud className="mx-auto mb-2 w-8 h-8 text-blue-500" />
                <h3 className="mb-1 text-sm font-semibold">Remote AI Processing</h3>
                <p className="text-xs text-muted-foreground">
                  AI requests are processed using our cloud-based service.
                  {apiKey ? ' API key configured.' : ' API key required for operation.'}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border">
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
} 
