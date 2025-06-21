import { BrowserWindow } from 'electron'

// Type augmentation for Puppeteer Page to include CDP client
declare module 'puppeteer-core' {
  interface Page {
    _cdpClient?: any
  }
}

export interface TeamsStatus {
  running: boolean
  authenticated: boolean
  active: boolean
}


export interface UserSettings {
  autoStart: boolean
  analytics: boolean
  theme: 'light' | 'dark' | 'system'
  startMinimized: boolean
  notifications: {
    teamsStatusChanges: boolean
    systemSleepPrevention: boolean
  }
}

export interface NotificationMessage {
  id: string
  sessionId: string
  timestamp: string
  from: string
  content: string
  conversationId: string
  conversationName: string
  messageType: string
  isRead: boolean
}

export interface NotificationSession {
  id: string
  startTime: string
  endTime?: string
  isActive: boolean
  messageCount: number
}

export interface AppSettings {
  autoStart: boolean
  analytics: boolean
  theme: 'system' | 'light' | 'dark'
  startMinimized: boolean
  notifications: {
    teamsStatusChanges: boolean
    systemSleepPrevention: boolean
  }
}

export interface TeamsSettings {
  autoStart: boolean
  keepAliveInterval: number
  preventSleep: boolean
}

export interface UpdateStatus {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error' | 'dev-mode'
  message: string
  info?: any
  error?: string
  progress?: any
}

export interface ChromeTeamsResult {
  success: boolean
  error?: string
}

// Manager interfaces
export interface IWindowManager {
  createWindow(): BrowserWindow
  setWindow(window: BrowserWindow): void
  getWindow(): BrowserWindow | null
}

export interface ITrayManager {
  createTray(windowManager: IWindowManager, teamsManager: ITeamsManager): void
  updateTrayMenu(): void
}

export interface ITeamsManager {
  setWindow(window: BrowserWindow): void
  startChrome(): Promise<ChromeTeamsResult>
  stopChrome(): Promise<ChromeTeamsResult>
  getStatus(): Promise<TeamsStatus>
  cleanup(): Promise<void>
  isActive(): boolean
}

export interface INotificationManager {
  setWindow(window: BrowserWindow): void
  startMonitoring(): Promise<void>
  stopMonitoring(): Promise<void>
  cleanup(): Promise<void>
}

export interface IAutoUpdaterManager {
  setup(window: BrowserWindow): void
  checkForUpdates(): Promise<any>
  installUpdate(): void
} 