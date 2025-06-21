/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
}

// Browser-related types
interface BrowserInfo {
  id: string
  name: string
  path: string
  version?: string
  isDefault?: boolean
}

interface BrowserSettings {
  selectedBrowserId: string | null
  availableBrowsers: BrowserInfo[]
}

// AI-related types
interface AIModelInfo {
  name: string
  modelId: string
  sizeDescription: string
  isDownloaded: boolean
}

interface DownloadProgress {
  status: 'initiate' | 'download' | 'progress' | 'done' | 'error'
  name: string
  file: string
  progress?: number
  loaded?: number
  total?: number
  error?: string
}

// Used in Renderer process, expose in `preload.ts`
interface Window {
  ipcRenderer: import('electron').IpcRenderer
  electronAPI: {
    // Update functions
    checkForUpdates: () => Promise<{ status: string; result?: any; error?: string; message?: string }>
    installUpdate: () => void
    onUpdateStatus: (callback: (status: any) => void) => void
    removeUpdateStatusListener: () => void
    onNavigateTo: (callback: (route: string) => void) => void

    // Chrome Teams functions
    startChromeTeams: () => Promise<{ success: boolean; error?: string }>
    stopChromeTeams: () => Promise<{ success: boolean; error?: string }>
    getChromeTeamsStatus: () => Promise<{ running: boolean; authenticated: boolean; active: boolean }>
    getTeamsAuthStatus: () => Promise<{ authenticated: boolean; accessToken: string | null }>
    onTeamsStatus: (callback: (status: { active: boolean }) => void) => void
    onTeamsAuthStatus: (callback: (status: { authenticated: boolean; accessToken?: string | null }) => void) => void
    removeTeamsListeners: () => void

    // Teams messaging functions
    sendTeamsMessage: (conversationId: string, content: string, senderName: string) => Promise<{ success: boolean; error?: string }>

    // Browser detection and selection functions
    detectBrowsers: () => Promise<BrowserInfo[]>
    getAvailableBrowsers: () => Promise<BrowserInfo[]>
    getSelectedBrowser: () => Promise<string | null>
    setSelectedBrowser: (browserId: string) => Promise<boolean>
    getBrowserSettings: () => Promise<BrowserSettings>

    // Storage functions
    getOnboardingCompleted: () => Promise<boolean>
    setOnboardingCompleted: (completed: boolean) => Promise<boolean>
    getAppSettings: () => Promise<any>
    setAppSettings: (settings: any) => Promise<boolean>
    getTeamsSettings: () => Promise<any>
    setTeamsSettings: (settings: any) => Promise<boolean>
    getUserSettings: () => Promise<any>
    setUserSettings: (settings: any) => Promise<boolean>
    setAutoStart: (enabled: boolean) => Promise<boolean>
    getAutoStart: () => Promise<boolean>

    // Notification functions
    getNotificationSessions: (limit?: number) => Promise<any[]>
    getNotificationMessages: (sessionId: string) => Promise<any[]>
    markNotificationAsRead: (messageId: string) => Promise<boolean>
    getUnreadNotificationCount: (sessionId?: string) => Promise<number>
    getActiveNotificationSession: () => Promise<string | null>
    onNewNotification: (callback: (notification: any) => void) => void
    onNewSession: (callback: (session: any) => void) => void
    removeNotificationListeners: () => void

    // AI functions
    getAvailableAIModels: () => Promise<AIModelInfo[]>
    getCurrentAIModel: () => Promise<string | null>
    isAIModelLoading: () => Promise<boolean>
    downloadAIModel: (modelId: string, sessionId: string) => Promise<boolean>
    loadAIModel: (modelId: string) => Promise<boolean>
    summarizeSession: (sessionId: string) => Promise<string>
    getAICachePath: () => Promise<string | null>
    saveCurrentAIModel: (modelId: string) => Promise<boolean>
    getSavedAIModel: () => Promise<string | null>
    onAIDownloadProgress: (callback: (data: { sessionId: string; progress: DownloadProgress }) => void) => void
    removeAIListeners: () => void
  }
}
