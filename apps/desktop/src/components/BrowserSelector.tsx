import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { 
  Chrome, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle,
  Monitor
} from 'lucide-react'
import type { BrowserInfo, BrowserSettings } from '@/types/electron'

const BrowserSelector: React.FC = () => {
  const [browserSettings, setBrowserSettings] = useState<BrowserSettings>({
    selectedBrowserId: null,
    availableBrowsers: []
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isDetecting, setIsDetecting] = useState(false)

  useEffect(() => {
    loadBrowserSettings()
  }, [])

  const loadBrowserSettings = async () => {
    setIsLoading(true)
    try {
      if (window.electronAPI) {
        const settings = await window.electronAPI.getBrowserSettings()
        setBrowserSettings(settings)
        
        // If no browsers detected yet, auto-detect
        if (settings.availableBrowsers.length === 0) {
          await detectBrowsers()
        }
      }
    } catch (error) {
      console.error('Failed to load browser settings:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const detectBrowsers = async () => {
    setIsDetecting(true)
    try {
      if (window.electronAPI) {
        const browsers = await window.electronAPI.detectBrowsers()
        setBrowserSettings(prev => ({
          ...prev,
          availableBrowsers: browsers
        }))
      }
    } catch (error) {
      console.error('Failed to detect browsers:', error)
    } finally {
      setIsDetecting(false)
    }
  }

  const handleBrowserSelect = async (browserId: string) => {
    try {
      if (window.electronAPI) {
        const success = await window.electronAPI.setSelectedBrowser(browserId)
        if (success) {
          setBrowserSettings(prev => ({
            ...prev,
            selectedBrowserId: browserId
          }))
        }
      }
    } catch (error) {
      console.error('Failed to select browser:', error)
    }
  }

  const getBrowserIcon = (browserId: string) => {
    if (browserId.includes('chrome')) {
      return <Chrome className="w-5 h-5 text-blue-500" />
    } else if (browserId.includes('edge')) {
      return <Monitor className="w-5 h-5 text-blue-600" />
    } else if (browserId.includes('brave')) {
      return <Chrome className="w-5 h-5 text-orange-500" />
    } else if (browserId.includes('opera')) {
      return <Chrome className="w-5 h-5 text-red-500" />
    } else if (browserId.includes('vivaldi')) {
      return <Chrome className="w-5 h-5 text-purple-500" />
    }
    return <Chrome className="w-5 h-5 text-gray-500" />
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Chrome className="w-5 h-5" />
            <span>Browser Selection</span>
          </CardTitle>
          <CardDescription>Loading browser settings...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Chrome className="w-5 h-5" />
          <span>Browser Selection</span>
        </CardTitle>
        <CardDescription>
          Choose which Chromium-based browser to use for Teams authentication
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Browser Detection */}
        <div className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            {browserSettings.availableBrowsers.length > 0 ? (
              <>Found {browserSettings.availableBrowsers.length} compatible browser{browserSettings.availableBrowsers.length !== 1 ? 's' : ''}</>
            ) : (
              'No browsers detected'
            )}
          </div>
          <Button
            onClick={detectBrowsers}
            disabled={isDetecting}
            variant="outline"
            size="sm"
          >
            {isDetecting ? (
              <RefreshCw className="mr-2 w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 w-4 h-4" />
            )}
            {isDetecting ? 'Detecting...' : 'Refresh'}
          </Button>
        </div>

        {/* Browser List */}
        {browserSettings.availableBrowsers.length > 0 ? (
          <RadioGroup
            value={browserSettings.selectedBrowserId || ''}
            onValueChange={handleBrowserSelect}
          >
            <div className="space-y-3">
              {browserSettings.availableBrowsers.map((browser) => (
                <div key={browser.id} className="flex items-center p-3 space-x-3 rounded-lg border hover:bg-muted/30">
                  <RadioGroupItem value={browser.id} id={browser.id} />
                  <Label htmlFor={browser.id} className="flex-1 cursor-pointer">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-3">
                        {getBrowserIcon(browser.id)}
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{browser.name}</span>
                            {browser.isDefault && (
                              <Badge variant="secondary" className="text-xs">
                                Default
                              </Badge>
                            )}
                            {browserSettings.selectedBrowserId === browser.id && (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            )}
                          </div>
                          {browser.version && (
                            <span className="text-sm text-muted-foreground">
                              Version {browser.version}
                            </span>
                          )}
                          <div className="font-mono text-xs text-muted-foreground">
                            {browser.path}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        ) : (
          <div className="py-8 text-center">
            <AlertCircle className="mx-auto mb-4 w-12 h-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-medium">No Compatible Browsers Found</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              DotBot requires a Chromium-based browser for Teams authentication.
            </p>
            <Button onClick={detectBrowsers} disabled={isDetecting}>
              {isDetecting ? (
                <RefreshCw className="mr-2 w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 w-4 h-4" />
              )}
              Try Again
            </Button>
          </div>
        )}

        {/* Info */}
        <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
          <div className="text-sm text-blue-800">
            <div className="mb-1 font-medium">Why Browser Selection?</div>
            <ul className="space-y-1 text-xs list-disc list-inside">
              <li>Different browsers may have different authentication capabilities</li>
              <li>Your selected browser will be used for Teams authentication</li>
              <li>If the selected browser becomes unavailable, DotBot will automatically fall back to the next available option</li>
              <li>All Chromium-based browsers support modern web authentication features</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default BrowserSelector 