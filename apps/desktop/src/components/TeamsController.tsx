import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Play, 
  Square, 
  Shield, 
  ShieldCheck, 
  Wifi, 
  WifiOff,
  CheckCircle,
  AlertCircle,
  Chrome,
  RefreshCw,
  Settings
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { TeamsStatus, TeamsAuthStatus, ChromeTeamsStatus, BrowserInfo } from '@/types/electron'

interface TeamsControllerProps {
  onSessionUpdate?: () => void
}

const TeamsController: React.FC<TeamsControllerProps> = ({ onSessionUpdate }) => {
  const [authStatus, setAuthStatus] = useState<TeamsAuthStatus>({
    authenticated: false,
    accessToken: null
  })
  const [chromeStatus, setChromeStatus] = useState<ChromeTeamsStatus>({
    running: false,
    authenticated: false,
    active: false
  })
  const [teamsStatus, setTeamsStatus] = useState<TeamsStatus>({
    active: false
  })
  const [isLoading, setIsLoading] = useState(false)
  const [availableBrowsers, setAvailableBrowsers] = useState<BrowserInfo[]>([])
  const [selectedBrowser, setSelectedBrowser] = useState<string | null>(null)
  const [showBrowserSettings, setShowBrowserSettings] = useState(false)

  useEffect(() => {
    // Get initial status
    if (window.electronAPI) {
      // Check Chrome Teams status
      if (window.electronAPI.getChromeTeamsStatus) {
        window.electronAPI.getChromeTeamsStatus().then(setChromeStatus)
      }

      // Get Teams auth status with access token if available
      if (window.electronAPI.getTeamsAuthStatus) {
        window.electronAPI.getTeamsAuthStatus().then(setAuthStatus)
      }

      // Load browser settings
      loadBrowserSettings()

      // Listen for status updates
      window.electronAPI.onTeamsStatus(setTeamsStatus)
      window.electronAPI.onTeamsAuthStatus(setAuthStatus)

      return () => {
        window.electronAPI.removeTeamsListeners()
      }
    }
  }, [])

  const loadBrowserSettings = async () => {
    try {
      if (window.electronAPI) {
        const [browsers, selected] = await Promise.all([
          window.electronAPI.getAvailableBrowsers(),
          window.electronAPI.getSelectedBrowser()
        ])
        
        setAvailableBrowsers(browsers)
        setSelectedBrowser(selected)
        
        // Auto-detect browsers if none available
        if (browsers.length === 0) {
          await detectBrowsers()
        }
      }
    } catch (error) {
      console.error('Failed to load browser settings:', error)
    }
  }

  const detectBrowsers = async () => {
    try {
      if (window.electronAPI) {
        const browsers = await window.electronAPI.detectBrowsers()
        setAvailableBrowsers(browsers)
        
        // Update selected browser if none set
        if (!selectedBrowser && browsers.length > 0) {
          const defaultBrowser = browsers.find(b => b.isDefault) || browsers[0]
          setSelectedBrowser(defaultBrowser.id)
        }
      }
    } catch (error) {
      console.error('Failed to detect browsers:', error)
    }
  }

  const handleBrowserSelect = async (browserId: string) => {
    try {
      if (window.electronAPI) {
        const success = await window.electronAPI.setSelectedBrowser(browserId)
        if (success) {
          setSelectedBrowser(browserId)
        }
      }
    } catch (error) {
      console.error('Failed to select browser:', error)
    }
  }

  // Chrome Teams handlers
  const handleStartChromeTeams = async () => {
    setIsLoading(true)
    try {
      if (window.electronAPI.startChromeTeams) {
        const result = await window.electronAPI.startChromeTeams()
        if (result.success) {
          // Refresh Chrome status
          const status = await window.electronAPI.getChromeTeamsStatus()
          setChromeStatus(status)
          onSessionUpdate?.()
        }
      }
    } catch (error) {
      console.error('Failed to start Chrome Teams:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStopChromeTeams = async () => {
    setIsLoading(true)
    try {
      if (window.electronAPI.stopChromeTeams) {
        await window.electronAPI.stopChromeTeams()
        // Refresh Chrome status
        const status = await window.electronAPI.getChromeTeamsStatus()
        setChromeStatus(status)
      }
    } catch (error) {
      console.error('Failed to stop Chrome Teams:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusIcon = () => {
    if (chromeStatus.active || teamsStatus.active) {
      return <CheckCircle className="w-5 h-5 text-green-500" />
    }
    return <AlertCircle className="w-5 h-5 text-gray-500" />
  }

  const getAuthIcon = () => {
    if (chromeStatus.authenticated || authStatus.authenticated) {
      return <CheckCircle className="w-4 h-4 text-green-500" />
    }
    return <AlertCircle className="w-4 h-4 text-red-500" />
  }

  const getBrowserIcon = (browserId: string) => {
    if (browserId.includes('chrome')) {
      return <Chrome className="w-4 h-4 text-blue-500" />
    } else if (browserId.includes('edge')) {
      return <Chrome className="w-4 h-4 text-blue-600" />
    } else if (browserId.includes('brave')) {
      return <Chrome className="w-4 h-4 text-orange-500" />
    }
    return <Chrome className="w-4 h-4 text-gray-500" />
  }

  const selectedBrowserInfo = availableBrowsers.find(b => b.id === selectedBrowser)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          {getStatusIcon()}
          <span>DotBot</span>
          <Badge variant="outline" className="ml-auto">
            <Chrome className="mr-1 w-3 h-3" />
            Chrome Mode
          </Badge>
        </CardTitle>
        <CardDescription>
          Keep Microsoft Teams active using Chrome for better authentication compatibility
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Browser Selection */}
        <div className="p-4 rounded-lg bg-muted/30">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center space-x-2">
              <Settings className="w-4 h-4" />
              <span className="text-sm font-medium">Browser Selection</span>
            </div>
            <Button
              onClick={() => setShowBrowserSettings(!showBrowserSettings)}
              variant="ghost"
              size="sm"
            >
              {showBrowserSettings ? 'Hide' : 'Show'}
            </Button>
          </div>
          
          {selectedBrowserInfo && (
            <div className="flex items-center space-x-2 text-sm">
              {getBrowserIcon(selectedBrowserInfo.id)}
              <span>
                Using: <strong>{selectedBrowserInfo.name}</strong>
                {selectedBrowserInfo.version && ` (v${selectedBrowserInfo.version})`}
              </span>
            </div>
          )}
          
          {showBrowserSettings && (
            <div className="mt-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  {availableBrowsers.length} browser{availableBrowsers.length !== 1 ? 's' : ''} detected
                </span>
                <Button
                  onClick={detectBrowsers}
                  variant="outline"
                  size="sm"
                >
                  <RefreshCw className="mr-2 w-4 h-4" />
                  Refresh
                </Button>
              </div>
              
              {availableBrowsers.length > 0 && (
                <div className="space-y-2">
                  {availableBrowsers.map((browser) => (
                    <div
                      key={browser.id}
                      className={`flex items-center justify-between p-2 rounded border cursor-pointer hover:bg-muted/50 ${
                        selectedBrowser === browser.id ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => handleBrowserSelect(browser.id)}
                    >
                      <div className="flex items-center space-x-3">
                        {getBrowserIcon(browser.id)}
                        <div>
                          <div className="text-sm font-medium">{browser.name}</div>
                          {browser.version && (
                            <div className="text-xs text-muted-foreground">
                              Version {browser.version}
                            </div>
                          )}
                        </div>
                      </div>
                      {selectedBrowser === browser.id && (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      )}
                      {browser.isDefault && (
                        <Badge variant="secondary" className="text-xs">
                          Default
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chrome Status Display */}
        <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/30">
          <div className="flex items-center space-x-2">
            {(chromeStatus.active || teamsStatus.active) ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-gray-500" />
            )}
            <span className="text-sm">
              Keep-Alive: {(chromeStatus.active || teamsStatus.active) ? 'Active' : 'Inactive'}
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            {chromeStatus.running ? (
              <Chrome className="w-4 h-4 text-blue-500" />
            ) : (
              <Chrome className="w-4 h-4 text-gray-500" />
            )}
            <span className="text-sm">
              Browser: {chromeStatus.running ? 'Running' : 'Stopped'}
            </span>
          </div>
          
          <div className="flex col-span-2 items-center space-x-2">
            {getAuthIcon()}
            <span className="text-sm">
              Teams Authentication: {(chromeStatus.authenticated || authStatus.authenticated) ? 'Signed In' : 'Not Signed In'}
            </span>
            {authStatus.accessToken && (
              <span className="ml-2 text-xs text-muted-foreground">
                (Token: {authStatus.accessToken.substring(0, 8)}...)
              </span>
            )}
          </div>
        </div>

        {/* Chrome Info */}
        <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
          <p className="text-sm text-blue-800">
            <Chrome className="inline mr-1 w-4 h-4" />
            Browser mode provides better authentication compatibility, especially for passkeys and biometrics.
          </p>
        </div>

        {/* Chrome Control Buttons */}
        <div className="flex flex-wrap gap-2">
          {chromeStatus.running ? (
            <Button
              onClick={handleStopChromeTeams}
              disabled={isLoading}
              variant="destructive"
              size="sm"
            >
              <Square className="mr-2 w-4 h-4" />
              Stop Browser Teams
            </Button>
          ) : (
            <Button
              onClick={handleStartChromeTeams}
              disabled={isLoading}
              size="sm"
            >
              <Chrome className="mr-2 w-4 h-4" />
              Launch {selectedBrowserInfo ? selectedBrowserInfo.name : 'Browser'} Teams
            </Button>
          )}
        </div>

        {/* Chrome Requirements */}
        {!chromeStatus.running && (
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>• Requires a Chromium-based browser to be installed</p>
            <p>• Browser will open in a separate window</p>
            <p>• Full WebAuthn/passkey support available</p>
            <p>• Keep-alive works automatically after authentication</p>
          </div>
        )}

        {/* General Information */}
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>• Keep-alive simulates minimal activity every 2 minutes</p>
          <p>• System sleep prevention keeps your computer awake</p>
          {(teamsStatus.active || chromeStatus.active) && (
            <p className="text-green-600">
              ✓ Teams will remain active while this is running
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default TeamsController 