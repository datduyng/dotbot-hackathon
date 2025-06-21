export interface UpdateStatus {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error' | 'dev-mode'
  message: string
  info?: {
    version: string
    files: Array<{
      url: string
      sha512: string
      size: number
    }>
    path: string
    sha512: string
    releaseDate: string
  }
  progress?: {
    bytesPerSecond: number
    percent: number
    transferred: number
    total: number
  }
  error?: string
}

export interface TeamsStatus {
  active: boolean
}

export interface TeamsAuthStatus {
  authenticated: boolean
  accessToken?: string | null
}

export interface ChromeTeamsStatus {
  running: boolean
  authenticated: boolean
  active: boolean
}

export interface BrowserInfo {
  id: string
  name: string
  path: string
  version?: string
  isDefault?: boolean
}

export interface BrowserSettings {
  selectedBrowserId: string | null
  availableBrowsers: BrowserInfo[]
}

declare global {
  interface Window {
    electronAPI: {
      checkForUpdates: () => Promise<{
        status: string
        result?: any
        error?: string
        message?: string
      }>
      installUpdate: () => void
      onUpdateStatus: (callback: (status: UpdateStatus) => void) => void
      removeUpdateStatusListener: () => void
      onNavigateTo: (callback: (route: string) => void) => void
      
      // Chrome Teams functions
      startChromeTeams: () => Promise<{ success: boolean; error?: string }>
      stopChromeTeams: () => Promise<{ success: boolean; error?: string }>
      getChromeTeamsStatus: () => Promise<ChromeTeamsStatus>
      onTeamsStatus: (callback: (status: TeamsStatus) => void) => void
      onTeamsAuthStatus: (callback: (status: TeamsAuthStatus) => void) => void
      removeTeamsListeners: () => void
      
      // Browser detection and selection functions
      detectBrowsers: () => Promise<BrowserInfo[]>
      getAvailableBrowsers: () => Promise<BrowserInfo[]>
      getSelectedBrowser: () => Promise<string | null>
      setSelectedBrowser: (browserId: string) => Promise<boolean>
      getBrowserSettings: () => Promise<BrowserSettings>
      
      // Settings and storage functions
      getOnboardingCompleted: () => Promise<boolean>
      setOnboardingCompleted: (completed: boolean) => Promise<boolean>
      getUserSettings: () => Promise<any>
      setUserSettings: (settings: any) => Promise<boolean>
      getAppSettings: () => Promise<any>
      setAppSettings: (settings: any) => Promise<boolean>
      getTeamsSettings: () => Promise<any>
      setTeamsSettings: (settings: any) => Promise<boolean>
      
      // Auto-start functionality
      setAutoStart: (enabled: boolean) => Promise<boolean>
      getAutoStart: () => Promise<boolean>
    }
  }
} 