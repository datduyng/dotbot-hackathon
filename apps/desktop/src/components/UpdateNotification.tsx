import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, CheckCircle, AlertCircle, RefreshCw, Loader2 } from 'lucide-react'
import type { UpdateStatus } from '@/types/electron'

const UpdateNotification: React.FC = () => {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    // Listen for update status changes from main process
    if (window.electronAPI) {
      window.electronAPI.onUpdateStatus((status: UpdateStatus) => {
        setUpdateStatus(status)
        setIsChecking(false)
      })

      return () => {
        window.electronAPI.removeUpdateStatusListener()
      }
    }
  }, [])

  const handleCheckForUpdates = async () => {
    if (!window.electronAPI) return
    
    setIsChecking(true)
    try {
      const result = await window.electronAPI.checkForUpdates()
      console.log('Update check result:', result)
    } catch (error) {
      console.error('Error checking for updates:', error)
      setIsChecking(false)
    }
  }

  const handleInstallUpdate = () => {
    if (window.electronAPI) {
      window.electronAPI.installUpdate()
    }
  }

  const getStatusIcon = () => {
    if (isChecking) return <Loader2 className="h-5 w-5 animate-spin" />
    
    switch (updateStatus?.status) {
      case 'checking':
        return <Loader2 className="h-5 w-5 animate-spin" />
      case 'available':
      case 'downloading':
        return <Download className="h-5 w-5 text-blue-500" />
      case 'downloaded':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'not-available':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />
      case 'dev-mode':
        return <RefreshCw className="h-5 w-5 text-orange-500" />
      default:
        return <RefreshCw className="h-5 w-5" />
    }
  }

  const getStatusColor = () => {
    switch (updateStatus?.status) {
      case 'available':
      case 'downloading':
        return 'text-blue-600'
      case 'downloaded':
      case 'not-available':
        return 'text-green-600'
      case 'error':
        return 'text-red-600'
      case 'dev-mode':
        return 'text-orange-600'
      default:
        return 'text-gray-600'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          {getStatusIcon()}
          <span>Application Updates</span>
        </CardTitle>
        <CardDescription>
          Keep your application up to date with the latest features and security improvements
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {updateStatus && (
          <div className={`p-3 rounded-md bg-muted/50 ${getStatusColor()}`}>
            <p className="text-sm font-medium">{updateStatus.message}</p>
            {updateStatus.progress && (
              <div className="mt-2">
                <div className="flex justify-between text-xs mb-1">
                  <span>Downloading...</span>
                  <span>{Math.round(updateStatus.progress.percent)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${updateStatus.progress.percent}%` }}
                  ></div>
                </div>
              </div>
            )}
            {updateStatus.info && (
              <p className="text-xs mt-1 opacity-75">
                Version {updateStatus.info.version} available
              </p>
            )}
          </div>
        )}
        
        <div className="flex space-x-2">
          <Button 
            onClick={handleCheckForUpdates}
            disabled={isChecking || updateStatus?.status === 'downloading'}
            variant="outline"
            size="sm"
          >
            {isChecking ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Check for Updates
              </>
            )}
          </Button>
          
          {updateStatus?.status === 'downloaded' && (
            <Button 
              onClick={handleInstallUpdate}
              size="sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Install & Restart
            </Button>
          )}
        </div>
        
        <div className="text-xs text-muted-foreground">
          <p>Current version: 1.0.0</p>
          {updateStatus?.status === 'dev-mode' && (
            <p className="text-orange-600 mt-1">
              Updates are not available in development mode
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default UpdateNotification 