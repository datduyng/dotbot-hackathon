import { app, BrowserWindow } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { storage } from '../storage'
import { WindowManager } from '../core/window-manager'
import { TrayManager } from '../core/tray-manager'
import { AutoUpdaterManager } from '../core/auto-updater'
import { TeamsManager } from '../services/teams-manager'
import { NotificationManager } from '../services/notification-manager'
import { AIService } from '../services/ai-service'
import { IPCHandlers } from '../ipc/handlers'
import { logger } from '../utils/logger'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

logger.info('🚀 Application starting...')
logger.info('Environment info:', {
  isDev: !app.isPackaged,
  platform: process.platform,
  arch: process.arch,
  electronVersion: process.versions.electron,
  nodeVersion: process.versions.node
})

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.mjs   > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.APP_ROOT = path.join(__dirname, '../..')
logger.info('APP_ROOT set to:', process.env.APP_ROOT)

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

logger.info('Path configuration:', {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL: VITE_DEV_SERVER_URL || 'not set'
})

// Add detailed path debugging
logger.info('Detailed path info:', {
  '__dirname (main process)': __dirname,
  'process.cwd()': process.cwd(),
  'app.getAppPath()': app.getAppPath(),
  'MAIN_DIST resolved': path.resolve(MAIN_DIST),
  'RENDERER_DIST resolved': path.resolve(RENDERER_DIST)
})

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

logger.info('VITE_PUBLIC set to:', process.env.VITE_PUBLIC)

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith('6.1')) {
  logger.info('Disabling hardware acceleration for Windows 7')
  app.disableHardwareAcceleration()
}

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') {
  logger.info('Setting app user model ID for Windows')
  app.setAppUserModelId(app.getName())
}

if (!app.requestSingleInstanceLock()) {
  logger.warn('Another instance is already running, quitting...')
  app.quit()
  process.exit(0)
} else {
  logger.info('Single instance lock acquired')
}

// Global managers
let windowManager: WindowManager
let trayManager: TrayManager
let autoUpdaterManager: AutoUpdaterManager
let teamsManager: TeamsManager
let notificationManager: NotificationManager
let aiService: AIService
let ipcHandlers: IPCHandlers

let isQuiting = false

app.on('window-all-closed', async () => {
  logger.info('All windows closed event')
  if (process.platform !== 'darwin') {
    logger.info('Quitting application (non-macOS)')
    app.quit()
  }
  try {
    await storage.close()
    logger.info('Storage closed successfully')
  } catch (error) {
    logger.error('Failed to close storage:', error)
  }
})

app.on('activate', () => {
  logger.info('App activate event')
  if (BrowserWindow.getAllWindows().length === 0) {
    logger.info('No windows open, creating new window')
    windowManager.createWindow()
  }
})

app.on('second-instance', () => {
  logger.info('Second instance detected, focusing main window')
  const window = windowManager.getWindow()
  if (window) {
    // Focus on the main window if the user tried to open another
    if (window.isMinimized()) window.restore()
    window.focus()
  }
})

app.on('before-quit', async () => {
  logger.info('Before quit event, cleaning up...')
  isQuiting = true
  
  // Cleanup all managers
  try {
    await teamsManager?.cleanup()
    logger.info('Teams manager cleaned up')
  } catch (error) {
    logger.error('Failed to cleanup teams manager:', error)
  }
  
  try {
    await notificationManager?.cleanup()
    logger.info('Notification manager cleaned up')
  } catch (error) {
    logger.error('Failed to cleanup notification manager:', error)
  }
  
  try {
    await aiService?.cleanup()
    logger.info('AI service cleaned up')
  } catch (error) {
    logger.error('Failed to cleanup AI service:', error)
  }
  
  try {
    await storage.close()
    logger.info('Storage closed during quit')
  } catch (error) {
    logger.error('Failed to close storage during quit:', error)
  }
})

app.whenReady().then(async () => {
  logger.info('🎯 App ready event triggered')
  
  try {
    // Clean old logs
    logger.cleanOldLogs()
    
    // Initialize storage first
    logger.info('Initializing storage...')
    await storage.init()
    logger.info('✅ Storage initialized successfully')
    
    // Initialize managers
    logger.info('Creating managers...')
    windowManager = new WindowManager()
    trayManager = new TrayManager(() => isQuiting)
    autoUpdaterManager = new AutoUpdaterManager()
    teamsManager = new TeamsManager()
    notificationManager = new NotificationManager()
    aiService = new AIService()
    logger.info('✅ All managers created')
    
    // Connect managers together
    teamsManager.setNotificationManager(notificationManager)
    logger.info('✅ Managers connected')
    
    // Initialize IPC handlers
    ipcHandlers = new IPCHandlers(teamsManager, notificationManager, aiService)
    logger.info('✅ IPC handlers created')
    
    // Create window and tray
    logger.info('Creating main window...')
    const window = windowManager.createWindow()
    logger.info('✅ Main window created')
    
    logger.info('Creating system tray...')
    trayManager.createTray(windowManager, teamsManager)
    logger.info('✅ System tray created')
    
    // Setup auto-updater with window reference
    logger.info('Setting up auto-updater...')
    autoUpdaterManager.setup(window)
    logger.info('✅ Auto-updater setup complete')
    
    // Setup IPC handlers
    logger.info('Setting up IPC handlers...')
    ipcHandlers.setupHandlers()
    logger.info('✅ IPC handlers setup complete')
    
    // Set global references for managers to communicate
    windowManager.setWindow(window)
    teamsManager.setWindow(window)
    notificationManager.setWindow(window)
    logger.info('✅ Manager references set')
    
    logger.info('🎉 Application initialization complete!')
    
  } catch (error) {
    logger.error('❌ Failed to initialize app:', error)
    logger.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace')
  }
})

export const getIsQuitting = () => isQuiting
export const getWindowManager = () => windowManager
export const getTrayManager = () => trayManager
export const getTeamsManager = () => teamsManager
export const getNotificationManager = () => notificationManager
export const getAIService = () => aiService
