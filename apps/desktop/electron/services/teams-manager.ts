import { BrowserWindow, powerSaveBlocker, dialog, app } from 'electron'
import puppeteer, { Browser, Page, HTTPRequest, HTTPResponse, ConsoleMessage } from 'puppeteer-core'
import path from 'node:path'
import { storage } from '../storage'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
import { 
  getChromePath, 
  getChromeArgs, 
  getUserAgent, 
  getHttpHeaders, 
  delay 
} from '../utils/helpers'

export class TeamsManager {
  private window: BrowserWindow | null = null
  private chromeBrowser: Browser | null = null
  private chromePage: Page | null = null
  private chromeKeepAliveInterval: NodeJS.Timeout | null = null
  private powerSaveBlockerId: number | null = null
  private isTeamsActive = false
  private notificationManager: any = null // Will be set externally

  setWindow(window: BrowserWindow): void {
    this.window = window
  }

  setNotificationManager(notificationManager: any): void {
    this.notificationManager = notificationManager
  }

  private sendAuthStatus(authenticated: boolean, accessToken: string | null) {
    this.window?.webContents.send('teams-auth-status', { 
      authenticated,
      accessToken: authenticated ? accessToken : null
    })
  }

  private sendTeamsStatus(active: boolean) {
    this.window?.webContents.send('teams-status', { active })
  }

  private async isAuthenticated(): Promise<{ isAuthenticated: boolean, accessToken: string | null }> {
    const accessToken = await this.getAccessToken()
    const isAuthenticated = !!(accessToken && accessToken.trim().length > 0)
    return { isAuthenticated, accessToken: isAuthenticated ? accessToken : null }
  }

  async startChrome(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🚀 Launching Chrome for Teams authentication...')
      
      const chromePath = await getChromePath()
      const userDataDir = path.join(app.getPath('userData'), 'chrome-user-data')
      const chromeArgs = getChromeArgs(userDataDir)
      
      // Launch Chrome with Teams-compatible arguments
      this.chromeBrowser = await puppeteer.launch({
        executablePath: chromePath,
        headless: false,
        userDataDir,
        args: chromeArgs,
        defaultViewport: null,
        ignoreDefaultArgs: ['--enable-automation', '--enable-blink-features=IdleDetection']
      })
      
      console.log('✅ Chrome launched successfully')
      
      // Create new page and navigate to Teams
      this.chromePage = await this.chromeBrowser.newPage()
      
      // Set the chrome page in notification manager if available
      if (this.notificationManager) {
        this.notificationManager.setChromePage(this.chromePage)
      }
      
      await this.setupPageHandlers()
      await this.navigateToTeams()
      
      const { isAuthenticated, accessToken } = await this.isAuthenticated()
      
      if (isAuthenticated) {
        console.log('✅ Teams is already authenticated in Chrome')
        await this.startKeepAlive()
        
        // Start notification monitoring if manager is available
        if (this.notificationManager) {
          await this.notificationManager.startMonitoring()
        }
        
        this.sendAuthStatus(true, accessToken)
        this.sendTeamsStatus(true)
        return { success: true }
      } else {
        this.sendAuthStatus(false, null)
        
        const result = await this.showAuthDialog()
        if (result) {
          await this.monitorAuthentication()
          return { success: true }
        } else {
          await this.stopChrome()
          return { success: false, error: 'User cancelled authentication' }
        }
      }
      
    } catch (error) {
      console.error('❌ Chrome launch failed:', error)
      await this.showErrorDialog(error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async stopChrome(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🛑 Stopping Chrome Teams...')
      
      // Stop notification monitoring first
      if (this.notificationManager) {
        await this.notificationManager.stopMonitoring()
      }
      
      await this.stopKeepAlive()
      
      if (this.chromePage && !this.chromePage.isClosed()) {
        await this.chromePage.close()
        this.chromePage = null
      }
      
      if (this.chromeBrowser) {
        await this.chromeBrowser.close()
        this.chromeBrowser = null
      }
      
      this.sendTeamsStatus(false)
      return { success: true }
      
    } catch (error) {
      console.error('❌ Failed to stop Chrome Teams:', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async getStatus(): Promise<{ running: boolean; authenticated: boolean; active: boolean }> {
    const isRunning = !!(this.chromeBrowser && this.chromeBrowser.connected)
    let isAuthenticated = false
    
    if (isRunning) {
      const { isAuthenticated: auth } = await this.isAuthenticated()
      isAuthenticated = auth
    }
    
    return {
      running: isRunning,
      authenticated: isAuthenticated,
      active: this.isTeamsActive && isRunning
    }
  }

  async getAuthStatus(): Promise<{ authenticated: boolean; accessToken: string | null }> {
    if (!this.chromeBrowser || !this.chromeBrowser.connected) {
      return { authenticated: false, accessToken: null }
    }
    const { isAuthenticated, accessToken } = await this.isAuthenticated()
    return { authenticated: isAuthenticated, accessToken }
  }

  async cleanup(): Promise<void> {
    await this.stopChrome()
  }

  isActive(): boolean {
    return this.isTeamsActive
  }

  private async setupPageHandlers(): Promise<void> {
    if (!this.chromePage) return

    // Enable request interception
    await this.chromePage.setRequestInterception(true)
    
    // Set user agent and headers
    await this.chromePage.setUserAgent(getUserAgent())
    await this.chromePage.setExtraHTTPHeaders(getHttpHeaders())
    
    // Setup event handlers
    this.chromePage.on('request', (request: HTTPRequest) => {
      const url = request.url()
      const method = request.method()
      const resourceType = request.resourceType()
      
      // Log interesting requests (filter out noise)
      if (url.includes('teams.microsoft.com') || 
          url.includes('microsoftonline.com') || 
          url.includes('graph.microsoft.com') ||
          resourceType === 'websocket' ||
          resourceType === 'xhr' ||
          resourceType === 'fetch') {
        // Log auth-related requests
        if (url.includes('login') || url.includes('auth') || url.includes('token')) {
          console.log(`[Chrome Auth Request] ${method} ${resourceType}: ${url}`)
        }
      }
      
      request.continue()
    })
    
    this.chromePage.on('response', (response: HTTPResponse) => {
      const url = response.url()
      const status = response.status()
      
      if (status >= 400 && (url.includes('teams.microsoft.com') || url.includes('microsoftonline.com'))) {
        // console.error(`[Chrome Response Error] ${status}: ${url}`)
      }
    })
    
    this.chromePage.on('console', (msg: ConsoleMessage) => {
      const text = msg.text()
      const type = msg.type()
      
      if (text.includes('error') || type === 'error') {
        // console.log(`[Chrome Console ${type.toUpperCase()}] ❌ ${text}`)
      } else if (text.includes('auth') || text.includes('token') || text.includes('login')) {
        // console.log(`[Chrome Console ${type.toUpperCase()}] 🔐 ${text}`)
      }
    })
    
    this.chromePage.on('pageerror', (error: Error) => {
      console.error('[Chrome Page Error]:', error.message)
    })
  }

  private async navigateToTeams(): Promise<void> {
    if (!this.chromePage) return

    console.log('🌐 Navigating to Teams...')
    
    try {
      const response = await this.chromePage.goto('https://teams.microsoft.com', { 
        waitUntil: 'domcontentloaded',
        timeout: 45000
      })
      
      if (!response || !response.ok()) {
        throw new Error(`Teams page failed to load: ${response?.status()} ${response?.statusText()}`)
      }
      
      console.log('✅ Teams page loaded successfully')
      
    } catch (navigationError) {
      console.error('❌ Navigation error:', navigationError)
      
      // Try alternative approach - wait and check if page loaded anyway
      await delay(3000)
      
      const currentUrl = await this.chromePage.url()
      console.log('Current URL after navigation attempt:', currentUrl)
      
      if (!currentUrl.includes('teams.microsoft.com')) {
        throw new Error('Failed to navigate to Teams')
      }
    }
    
    // Wait for page to be interactive
    try {
      await Promise.race([
        this.chromePage.waitForSelector('[data-tid="signin-button"]', { timeout: 15000 }),
        this.chromePage.waitForSelector('[data-tid="app-bar"]', { timeout: 15000 }),
        this.chromePage.waitForSelector('.signin-button', { timeout: 15000 }),
        this.chromePage.waitForSelector('#signin', { timeout: 15000 }),
        this.chromePage.waitForSelector('button[type="submit"]', { timeout: 15000 }),
        this.chromePage.waitForSelector('.ms-Button--primary', { timeout: 15000 }),
        this.chromePage.waitForSelector('button, input, a[href]', { timeout: 15000 })
      ])
      
      console.log('✅ Teams page is interactive')
      
    } catch (error) {
      console.error('❌ Teams page load timeout:', error)
      // Continue anyway - user might be able to navigate manually
    }
  }

  private async checkAuthentication(): Promise<boolean> {
    if (!this.chromePage) return false
    
    try {
      const { isAuthenticated, accessToken } = await this.isAuthenticated()
      console.log('🔍 Chrome Teams authentication status:', isAuthenticated)
      this.sendAuthStatus(isAuthenticated, accessToken)
      return isAuthenticated
    } catch (error) {
      console.error('❌ Failed to check Chrome Teams auth:', error)
      return false
    }
  }

  private async getAccessToken(): Promise<string | null> {
    if (!this.chromePage) return null
    
    try {
      const accessToken = await this.chromePage.evaluate(/*js*/`
        (() => {
          // Look for all keys in localStorage
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key) continue;
            
            // Check if key contains all required substrings
            if (key.includes('login.windows.net-accesstoken') && 
                key.includes('teams.accessasuser.all') && 
                key.includes('teams.office.com/.default')) {
              
              try {
                const value = localStorage.getItem(key);
                if (!value) continue;
                
                const parsedValue = JSON.parse(value);
                
                // Check if value has the required structure
                if (parsedValue && 
                    parsedValue.secret && 
                    parsedValue.credentialType && 
                    parsedValue.credentialType.toLowerCase() === 'accesstoken') {
                  
                  console.log('Found Teams access token in localStorage key:', key);
                  return parsedValue.secret;
                }
              } catch (parseError) {
                console.warn('Failed to parse localStorage value for key:', key, parseError);
                continue;
              }
            }
          }
          
          console.log('No valid Teams access token found in localStorage');
          return null;
        })()
      `) as unknown as string | null
      
      return accessToken
      
    } catch (error) {
      console.error('❌ Failed to get access token from localStorage:', error)
      return null
    }
  }

  private async showAuthDialog(): Promise<boolean> {
    if (!this.window) return false

    const result = await dialog.showMessageBox(this.window, {
      type: 'info',
      buttons: ['OK', 'Cancel'],
      defaultId: 0,
      title: 'Chrome Teams Authentication',
      message: 'Please sign in to Teams in the Chrome window',
      detail: 'A Chrome window has opened with Teams. Please complete your sign-in there. The app will automatically detect when you\'re authenticated.'
    })
    
    return result.response === 0
  }

  private async showErrorDialog(error: any): Promise<void> {
    if (!this.window) return

    await dialog.showMessageBox(this.window, {
      type: 'error',
      buttons: ['OK'],
      title: 'Chrome Launch Failed',
      message: 'Could not launch Google Chrome',
      detail: `Error: ${error instanceof Error ? error.message : String(error)}\n\nPlease make sure Google Chrome is installed and try again. Chrome is required for reliable Teams authentication.`
    })
  }

  private async monitorAuthentication(): Promise<void> {
    if (!this.chromePage) return
    
    console.log('👀 Starting Chrome authentication monitoring...')
    
    let checkCount = 0
    const maxChecks = 120 // Monitor for 4 minutes
    
    const authCheckInterval = setInterval(async () => {
      checkCount++
      
      try {
        const { isAuthenticated, accessToken } = await this.isAuthenticated()
        this.sendAuthStatus(isAuthenticated, accessToken)
        
        if (isAuthenticated) {
          console.log('✅ Chrome Teams authentication successful!')
          clearInterval(authCheckInterval)
          
          await this.startKeepAlive()
          
          // Start notification monitoring if manager is available
          if (this.notificationManager) {
            await this.notificationManager.startMonitoring()
          }
          
          this.sendTeamsStatus(true)
          
          if (this.window) {
            dialog.showMessageBox(this.window, {
              type: 'info',
              buttons: ['OK'],
              title: 'Authentication Successful',
              message: 'Teams authentication completed!',
              detail: 'Keep-alive is now active. You can minimize the Chrome window.'
            })
          }
          
          return
        }
        
        if (checkCount >= maxChecks) {
          console.log('⏰ Chrome auth monitoring timeout')
          clearInterval(authCheckInterval)
          
          if (this.window) {
            dialog.showMessageBox(this.window, {
              type: 'warning',
              buttons: ['OK'],
              title: 'Authentication Timeout',
              message: 'Authentication monitoring stopped',
              detail: 'Please try again or check if you completed sign-in in the Chrome window.'
            })
          }
        }
        
      } catch (error) {
        console.error('❌ Chrome auth check error:', error)
      }
      
    }, 2000) // Check every 2 seconds
  }

  private async startKeepAlive(): Promise<void> {
    if (!this.chromePage || this.chromeKeepAliveInterval) return
    
    console.log('🚀 Starting Chrome Teams keep-alive...')
    
    // Block system sleep
    if (!this.powerSaveBlockerId) {
      this.powerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep')
      console.log('Power save blocker started:', this.powerSaveBlockerId)
    }
    
    // Simulate activity every 2 minutes and check auth status
    this.chromeKeepAliveInterval = setInterval(async () => {
      try {
        if (this.chromePage && !this.chromePage.isClosed()) {
          const { isAuthenticated, accessToken } = await this.isAuthenticated()
          this.sendAuthStatus(isAuthenticated, accessToken)
          
          if (!isAuthenticated) {
            console.log('⚠️ Teams authentication lost during keep-alive')
            // Don't stop keep-alive immediately, user might be re-authenticating
            return
          }
          
          // Simulate activity to keep Teams active
          await this.chromePage.evaluate(/*js*/`
            (() => {
              const event = new MouseEvent('mousemove', {
                clientX: Math.random() * 10,
                clientY: Math.random() * 10,
                bubbles: true
              });
              document.dispatchEvent(event);
            
              window.scrollBy(0, 1);
              setTimeout(() => window.scrollBy(0, -1), 100);
            
              console.log('Chrome keep-alive activity simulated at', new Date().toLocaleTimeString());
            })()
          `)
          
          console.log('✅ Chrome keep-alive activity completed')
        }
      } catch (error) {
        console.error('❌ Chrome keep-alive simulation failed:', error)
      }
    }, 120000) // Every 2 minutes
    
    this.isTeamsActive = true
    this.sendTeamsStatus(true)
  }

  private async stopKeepAlive(): Promise<void> {
    console.log('🛑 Stopping Chrome Teams keep-alive...')
    
    if (this.chromeKeepAliveInterval) {
      clearInterval(this.chromeKeepAliveInterval)
      this.chromeKeepAliveInterval = null
    }
    
    if (this.powerSaveBlockerId !== null) {
      powerSaveBlocker.stop(this.powerSaveBlockerId)
      this.powerSaveBlockerId = null
      console.log('Power save blocker stopped')
    }
    
    this.isTeamsActive = false
    this.sendTeamsStatus(false)
  }
} 