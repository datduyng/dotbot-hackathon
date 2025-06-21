import { BrowserWindow } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { VITE_DEV_SERVER_URL, RENDERER_DIST, MAIN_DIST } from '../main'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { getIsQuitting } from '../main'
import { logger } from '../utils/logger'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export class WindowManager {
  private window: BrowserWindow | null = null

  createWindow(): BrowserWindow {
    logger.info('🪟 Creating main window...')
    
    const preloadPath = path.join(MAIN_DIST, 'preload/index.mjs')
    const iconPath = path.join(process.env.VITE_PUBLIC!, 'electron-vite.svg')
    
    logger.info('Window configuration:', {
      preloadPath,
      iconPath,
      VITE_PUBLIC: process.env.VITE_PUBLIC,
      MAIN_DIST,
      RENDERER_DIST
    })

    this.window = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      icon: iconPath,
      webPreferences: {
        preload: preloadPath,
        nodeIntegration: false,
        contextIsolation: true,
      },
      show: false, // Don't show until ready
      titleBarStyle: process.platform === 'darwin' ? 'default' : 'default',
      titleBarOverlay: false,
    })
    
    logger.info('✅ BrowserWindow created successfully')

      logger.info('Opening DevTools in development mode')
      this.window?.webContents.openDevTools({ mode: 'detach' })

    // Open DevTools in a separate window by default
    this.window.webContents.once('did-frame-finish-load', () => {
      logger.info('🎯 Frame finished loading')
      // if dev mode is enabled, open devtools
      // if (process.env.VITE_DEV_SERVER_URL) {
        this.window?.webContents.openDevTools({ mode: 'detach' })
      // }
    })

    // Show window when ready to prevent visual flash
    this.window.once('ready-to-show', () => {
      logger.info('🎯 Window ready to show, making visible')
      this.window?.show()
    })

    // Test active push message to Renderer-process
    this.window.webContents.on('did-finish-load', () => {
      logger.info('🎯 WebContents finished loading')
      this.window?.webContents.send('main-process-message', (new Date).toLocaleString())
    })

    // Log navigation events
    this.window.webContents.on('did-start-loading', () => {
      logger.info('🔄 Started loading page')
    })

    this.window.webContents.on('did-stop-loading', () => {
      logger.info('✅ Stopped loading page')
    })

    this.window.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      logger.error('❌ Failed to load page:', {
        errorCode,
        errorDescription,
        validatedURL
      })
    })

    // Log console messages from renderer
    this.window.webContents.on('console-message', (event, level, message, line, sourceId) => {
      const logLevel = level === 1 ? 'warn' : level === 2 ? 'error' : 'info'
      logger[logLevel](`Renderer console [${sourceId}:${line}]:`, message)
    })

    // Load the appropriate URL/file
    if (VITE_DEV_SERVER_URL) {
      logger.info('Loading development server URL:', VITE_DEV_SERVER_URL)
      this.window.loadURL(VITE_DEV_SERVER_URL)
    } else {
      const indexPath = path.join(RENDERER_DIST, 'index.html')
      logger.info('Loading production file:', indexPath)
      
      // Add more detailed path debugging
      logger.info('Path resolution debug:', {
        __dirname: __dirname,
        'process.cwd()': process.cwd(),
        'process.env.APP_ROOT': process.env.APP_ROOT,
        RENDERER_DIST,
        indexPath,
        'path.resolve(indexPath)': path.resolve(indexPath)
      })
      
      // Check if file exists before loading
      try {
        if (fs.existsSync(indexPath)) {
          logger.info('✅ Index file exists, loading...')
          this.window.loadFile(indexPath)
        } else {
          logger.error('❌ Index file does not exist at path:', indexPath)
          
          // Try to list directory contents for debugging
          try {
            const dirContents = fs.readdirSync(RENDERER_DIST)
            logger.info('RENDERER_DIST contents:', dirContents)
          } catch (dirError) {
            logger.error('❌ Could not read RENDERER_DIST directory:', dirError)
          }
          
          // Still try to load the file
          logger.info('Attempting to load file anyway...')
          this.window.loadFile(indexPath)
        }
      } catch (error) {
        logger.error('❌ Error checking index file:', {
          error: error instanceof Error ? {
            name: error.name,
            message: error.message,
            stack: error.stack
          } : error,
          indexPath,
          RENDERER_DIST
        })
        
        // Try to load anyway
        logger.info('Attempting to load file despite error...')
        this.window.loadFile(indexPath)
      }
    }

    // Handle window closed
    this.window.on('closed', () => {
      logger.info('🪟 Window closed')
      this.window = null
    })

    // Hide to tray instead of closing on macOS
    this.window.on('close', (event) => {
      if (process.platform === 'darwin') {
        // Import isQuiting from main to check if we're actually quitting
        const isQuiting = getIsQuitting()
        if (!isQuiting) {
          logger.info('🍎 macOS: Hiding window to tray instead of closing')
          event.preventDefault()
          this.window?.hide()
        } else {
          logger.info('🍎 macOS: Allowing window to close (app is quitting)')
        }
      }
    })

    logger.info('🎉 Window setup complete')
    return this.window
  }

  setWindow(window: BrowserWindow): void {
    this.window = window
  }

  getWindow(): BrowserWindow | null {
    return this.window
  }

  showWindow(): void {
    if (this.window === null) {
      this.createWindow()
    } else {
      this.window.show()
      this.window.focus()
    }
  }

  hideWindow(): void {
    this.window?.hide()
  }

  isWindowVisible(): boolean {
    return this.window?.isVisible() ?? false
  }

  sendToRenderer(channel: string, ...args: any[]): void {
    this.window?.webContents.send(channel, ...args)
  }

  navigateTo(route: string): void {
    this.sendToRenderer('navigate-to', route)
  }
} 