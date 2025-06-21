import { ipcMain, app } from 'electron'
import { storage } from '../storage'
import { TeamsManager } from '../services/teams-manager'
import { NotificationManager } from '../services/notification-manager'
import { AIService } from '../services/ai-service'
import { teamsMessaging } from '../services/teams-messaging'
import { logger } from '../utils/logger'
import { BrowserDetector } from '../utils/browser-detector'

export class IPCHandlers {
  private teamsManager: TeamsManager
  private notificationManager: NotificationManager
  private aiService: AIService

  constructor(teamsManager: TeamsManager, notificationManager: NotificationManager, aiService: AIService) {
    this.teamsManager = teamsManager
    this.notificationManager = notificationManager
    this.aiService = aiService
  }

  setupHandlers(): void {
    logger.info('Setting up IPC handlers...')
    this.setupTeamsHandlers()
    this.setupStorageHandlers()
    this.setupNotificationHandlers()
    this.setupAIHandlers()
    this.setupAppHandlers()
    this.setupUpdateHandlers()
    this.setupLogHandlers()
    logger.info('All IPC handlers setup complete')
  }

  private setupTeamsHandlers(): void {
    // Chrome Teams functionality
    ipcMain.handle('start-chrome-teams', async () => {
      try {
        const result = await this.teamsManager.startChrome()
        
        // Start notification monitoring if Teams started successfully
        if (result.success) {
          await this.notificationManager.startMonitoring()
        }
        
        return result
      } catch (error) {
        console.error('❌ Failed to start Chrome Teams:', error)
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    })

    ipcMain.handle('stop-chrome-teams', async () => {
      try {
        // Stop notification monitoring first
        await this.notificationManager.stopMonitoring()
        
        const result = await this.teamsManager.stopChrome()
        return result
      } catch (error) {
        console.error('❌ Failed to stop Chrome Teams:', error)
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    })

    ipcMain.handle('get-chrome-teams-status', async () => {
      try {
        return await this.teamsManager.getStatus()
      } catch (error) {
        console.error('❌ Failed to get Chrome Teams status:', error)
        return {
          running: false,
          authenticated: false,
          active: false
        }
      }
    })

    ipcMain.handle('get-teams-auth-status', async () => {
      try {
        return await this.teamsManager.getAuthStatus()
      } catch (error) {
        console.error('❌ Failed to get Teams auth status:', error)
        return {
          authenticated: false,
          accessToken: null
        }
      }
    })

    ipcMain.handle('send-teams-message', async (_event, conversationId: string, content: string, senderName: string) => {
      try {
        logger.info(`IPC: Sending Teams message to conversation: ${conversationId}`)
        
        // Get the current access token from Teams Manager
        const authStatus = await this.teamsManager.getAuthStatus()
        
        if (!authStatus.authenticated || !authStatus.accessToken) {
          const error = 'Teams authentication required. Please ensure you are signed in to Teams.'
          logger.error('Teams message send failed:', error)
          return { success: false, error }
        }

        // Use the Teams messaging service to send the message
        const result = await teamsMessaging.sendMessage(
          conversationId, 
          content, 
          senderName, 
          authStatus.accessToken
        )

        if (result.success) {
          logger.info('Teams message sent successfully via IPC')
        } else {
          logger.error('Teams message send failed via IPC:', result.error)
        }

        return result
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error('IPC Teams message send error:', errorMessage)
        return { 
          success: false, 
          error: `Internal error: ${errorMessage}` 
        }
      }
    })
  }

  private setupStorageHandlers(): void {
    // Onboarding
    ipcMain.handle('get-onboarding-completed', async () => {
      try {
        return await storage.getOnboardingCompleted()
      } catch (error) {
        console.error('Failed to get onboarding status:', error)
        return false
      }
    })

    ipcMain.handle('set-onboarding-completed', async (_event, completed: boolean) => {
      try {
        await storage.setOnboardingCompleted(completed)
        return true
      } catch (error) {
        console.error('Failed to set onboarding status:', error)
        return false
      }
    })

    // App settings
    ipcMain.handle('get-app-settings', async () => {
      try {
        return await storage.getAppSettings()
      } catch (error) {
        console.error('Failed to get app settings:', error)
        return {}
      }
    })

    ipcMain.handle('set-app-settings', async (_event, settings: any) => {
      try {
        await storage.setAppSettings(settings)
        return true
      } catch (error) {
        console.error('Failed to set app settings:', error)
        return false
      }
    })

    // Teams settings
    ipcMain.handle('get-teams-settings', async () => {
      try {
        return await storage.getTeamsSettings()
      } catch (error) {
        console.error('Failed to get teams settings:', error)
        return {
          autoStart: false,
          keepAliveInterval: 120000,
          preventSleep: true
        }
      }
    })

    ipcMain.handle('set-teams-settings', async (_event, settings: any) => {
      try {
        await storage.setTeamsSettings(settings)
        return true
      } catch (error) {
        console.error('Failed to set teams settings:', error)
        return false
      }
    })

    // User settings
    ipcMain.handle('get-user-settings', async () => {
      try {
        return await storage.getUserSettings()
      } catch (error) {
        console.error('Failed to get user settings:', error)
        return {
          autoStart: false,
          analytics: false,
          theme: 'system',
          startMinimized: false,
          notifications: {
            teamsStatusChanges: true,
            systemSleepPrevention: true
          }
        }
      }
    })

    ipcMain.handle('set-user-settings', async (_event, settings: any) => {
      try {
        await storage.setUserSettings(settings)
        return true
      } catch (error) {
        console.error('Failed to set user settings:', error)
        return false
      }
    })

    // Browser settings
    ipcMain.handle('detect-browsers', async () => {
      try {
        const browsers = await BrowserDetector.detectBrowsers()
        
        // Update storage with detected browsers
        await storage.updateAvailableBrowsers(browsers)
        
        // Set default browser if none selected
        const selectedBrowser = await storage.getSelectedBrowser()
        if (!selectedBrowser && browsers.length > 0) {
          const defaultBrowser = browsers.find(b => b.isDefault) || browsers[0]
          await storage.setSelectedBrowser(defaultBrowser.id)
        }
        
        return browsers
      } catch (error) {
        console.error('Failed to detect browsers:', error)
        return []
      }
    })

    ipcMain.handle('get-available-browsers', async () => {
      try {
        return await storage.getAvailableBrowsers()
      } catch (error) {
        console.error('Failed to get available browsers:', error)
        return []
      }
    })

    ipcMain.handle('get-selected-browser', async () => {
      try {
        return await storage.getSelectedBrowser()
      } catch (error) {
        console.error('Failed to get selected browser:', error)
        return null
      }
    })

    ipcMain.handle('set-selected-browser', async (_event, browserId: string) => {
      try {
        await storage.setSelectedBrowser(browserId)
        return true
      } catch (error) {
        console.error('Failed to set selected browser:', error)
        return false
      }
    })

    ipcMain.handle('get-browser-settings', async () => {
      try {
        return await storage.getBrowserSettings()
      } catch (error) {
        console.error('Failed to get browser settings:', error)
        return {
          selectedBrowserId: null,
          availableBrowsers: []
        }
      }
    })
  }

  private setupNotificationHandlers(): void {
    ipcMain.handle('get-notification-sessions', async (_event, limit?: number) => {
      try {
        return await this.notificationManager.getNotificationSessions(limit)
      } catch (error) {
        console.error('Failed to get notification sessions:', error)
        return []
      }
    })

    ipcMain.handle('get-notification-messages', async (_event, sessionId: string) => {
      try {
        return await this.notificationManager.getNotificationMessages(sessionId)
      } catch (error) {
        console.error('Failed to get notification messages:', error)
        return []
      }
    })

    ipcMain.handle('mark-notification-as-read', async (_event, messageId: string) => {
      try {
        await this.notificationManager.markNotificationAsRead(messageId)
        return true
      } catch (error) {
        console.error('Failed to mark notification as read:', error)
        return false
      }
    })

    ipcMain.handle('get-unread-notification-count', async (_event, sessionId?: string) => {
      try {
        return await this.notificationManager.getUnreadNotificationCount(sessionId)
      } catch (error) {
        console.error('Failed to get unread notification count:', error)
        return 0
      }
    })

    ipcMain.handle('get-active-notification-session', async () => {
      try {
        return await this.notificationManager.getActiveNotificationSession()
      } catch (error) {
        console.error('Failed to get active notification session:', error)
        return null
      }
    })
  }

  private setupAppHandlers(): void {
    // Auto-start functionality
    ipcMain.handle('set-auto-start', async (_event, enabled: boolean) => {
      try {
        app.setLoginItemSettings({
          openAtLogin: enabled,
          openAsHidden: true // Start minimized to tray
        })
        
        // Also save to user settings
        await storage.updateUserSetting('autoStart', enabled)
        return true
      } catch (error) {
        console.error('Failed to set auto-start:', error)
        return false
      }
    })

    ipcMain.handle('get-auto-start', async () => {
      try {
        const loginItemSettings = app.getLoginItemSettings()
        return loginItemSettings.openAtLogin
      } catch (error) {
        console.error('Failed to get auto-start status:', error)
        return false
      }
    })

    // App version
    ipcMain.handle('get-app-version', () => {
      return app.getVersion()
    })
  }

  private setupUpdateHandlers(): void {
    // These will be handled by AutoUpdaterManager, but we need to expose them to IPC
    ipcMain.handle('check-for-updates', async () => {
      if (!app.isPackaged) {
        return { status: 'dev-mode', message: 'Updates are not available in development mode.' }
      }
      
      try {
        // This would need to be connected to AutoUpdaterManager
        // For now, return a placeholder
        return { status: 'success', message: 'Update check initiated' }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error('Manual update check failed:', errorMessage)
        return { status: 'error', error: errorMessage }
      }
    })

    ipcMain.handle('install-update', () => {
      // This would need to be connected to AutoUpdaterManager
      console.log('Install update requested')
    })
  }

  setupLogHandlers(): void {
    // Get log file paths for debugging
    ipcMain.handle('get-log-paths', () => {
      return {
        logFile: logger.getLogPath(),
        errorFile: logger.getErrorLogPath(),
        userDataPath: app.getPath('userData')
      }
    })

    // Get recent log content
    ipcMain.handle('get-recent-logs', async (event, lines = 50) => {
      try {
        const fs = require('fs')
        const logPath = logger.getLogPath()
        
        if (fs.existsSync(logPath)) {
          const content = fs.readFileSync(logPath, 'utf-8')
          const logLines = content.split('\n')
          return logLines.slice(-lines).join('\n')
        } else {
          return 'Log file not found'
        }
      } catch (error) {
        logger.error('Failed to read log file:', error)
        return `Error reading logs: ${error instanceof Error ? error.message : String(error)}`
      }
    })
  }

  private setupAIHandlers(): void {
    // Get available models
    ipcMain.handle('ai-get-available-models', async () => {
      try {
        // return this.aiService.getAvailableModels()
        return []
      } catch (error) {
        console.error('Failed to get available models:', error)
        return []
      }
    })

    // Get current model
    ipcMain.handle('ai-get-current-model', async () => {
      try {
        // return this.aiService.getCurrentModel()
        return null
      } catch (error) {
        console.error('Failed to get current model:', error)
        return null
      }
    })

    // Check if model is loading
    ipcMain.handle('ai-is-model-loading', async () => {
      try {
        // return this.aiService.isModelLoading()
        return false
      } catch (error) {
        console.error('Failed to check if model is loading:', error)
        return false
      }
    })

    // Download model with progress
    ipcMain.handle('ai-download-model', async (event, modelId: string, sessionId: string) => {
      try {
        const progressCallback = (progress: any) => {
          event.sender.send('ai-download-progress', { sessionId, progress })
        }
        
        // return await this.aiService.downloadModel(modelId, sessionId, progressCallback)
        return false
      } catch (error) {
        console.error('Failed to download model:', error)
        return false
      }
    })

    // Load model
    ipcMain.handle('ai-load-model', async (_event, modelId: string) => {
      try {
        // return await this.aiService.loadModel(modelId)
        return false
      } catch (error) {
        console.error('Failed to load model:', error)
        throw error
      }
    })

    // Summarize session notifications
    ipcMain.handle('ai-summarize-session', async (_event, sessionId: string) => {
      try {
        // Get all messages for the session
        const messages = await this.notificationManager.getNotificationMessages(sessionId)
        
        if (messages.length === 0) {
          return 'No messages found in this session.'
        }

        // Combine all message content
        const combinedText = messages
          .map(msg => `From ${msg.from}: ${msg.content}`)
          .join('\n\n')

        // Summarize using AI service
        const summary = await this.aiService.summarizeText(combinedText)
        return summary
      } catch (error) {
        console.error('Failed to summarize session:', error)
        throw error
      }
    })

    // Get model cache path
    ipcMain.handle('ai-get-cache-path', async () => {
      try {
        // return this.aiService.getModelCachePath()
        return null
      } catch (error) {
        console.error('Failed to get cache path:', error)
        return null
      }
    })

    // Save current AI model
    ipcMain.handle('ai-save-current-model', async (_event, modelId: string) => {
      try {
        await storage.setCurrentAIModel(modelId)
        return true
      } catch (error) {
        console.error('Failed to save current AI model:', error)
        return false
      }
    })

    // Load saved AI model
    ipcMain.handle('ai-get-saved-model', async () => {
      try {
        return await storage.getCurrentAIModel()
      } catch (error) {
        console.error('Failed to get saved AI model:', error)
        return null
      }
    })
  }
} 