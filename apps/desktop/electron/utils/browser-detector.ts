import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

export interface BrowserInfo {
  id: string
  name: string
  path: string
  version?: string
  isDefault?: boolean
}

export class BrowserDetector {
  /**
   * Detect all available Chromium-based browsers on the system
   */
  static async detectBrowsers(): Promise<BrowserInfo[]> {
    const browsers: BrowserInfo[] = []
    
    if (process.platform === 'darwin') {
      browsers.push(...this.detectMacBrowsers())
    } else if (process.platform === 'win32') {
      browsers.push(...this.detectWindowsBrowsers())
    } else {
      browsers.push(...this.detectLinuxBrowsers())
    }
    
    // Filter out browsers that don't exist and add version info
    const validBrowsers: BrowserInfo[] = []
    for (const browser of browsers) {
      if (this.browserExists(browser.path)) {
        try {
          browser.version = await this.getBrowserVersion(browser.path)
          validBrowsers.push(browser)
        } catch (error) {
          // If we can't get version, still include the browser
          validBrowsers.push(browser)
        }
      }
    }
    
    // Mark the first browser as default if none specified
    if (validBrowsers.length > 0 && !validBrowsers.some(b => b.isDefault)) {
      validBrowsers[0].isDefault = true
    }
    
    return validBrowsers
  }
  
  /**
   * Detect browsers on macOS
   */
  private static detectMacBrowsers(): BrowserInfo[] {
    const browsers: BrowserInfo[] = [
      {
        id: 'chrome',
        name: 'Google Chrome',
        path: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        isDefault: true
      },
      {
        id: 'chrome-beta',
        name: 'Google Chrome Beta',
        path: '/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta'
      },
      {
        id: 'chrome-canary',
        name: 'Google Chrome Canary',
        path: '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary'
      },
      {
        id: 'chromium',
        name: 'Chromium',
        path: '/Applications/Chromium.app/Contents/MacOS/Chromium'
      },
      {
        id: 'edge',
        name: 'Microsoft Edge',
        path: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
      },
      {
        id: 'edge-beta',
        name: 'Microsoft Edge Beta',
        path: '/Applications/Microsoft Edge Beta.app/Contents/MacOS/Microsoft Edge Beta'
      },
      {
        id: 'edge-dev',
        name: 'Microsoft Edge Dev',
        path: '/Applications/Microsoft Edge Dev.app/Contents/MacOS/Microsoft Edge Dev'
      },
      {
        id: 'brave',
        name: 'Brave Browser',
        path: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
      },
      {
        id: 'opera',
        name: 'Opera',
        path: '/Applications/Opera.app/Contents/MacOS/Opera'
      },
      {
        id: 'vivaldi',
        name: 'Vivaldi',
        path: '/Applications/Vivaldi.app/Contents/MacOS/Vivaldi'
      }
    ]
    
    return browsers
  }
  
  /**
   * Detect browsers on Windows
   */
  private static detectWindowsBrowsers(): BrowserInfo[] {
    const browsers: BrowserInfo[] = [
      {
        id: 'chrome',
        name: 'Google Chrome',
        path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        isDefault: true
      },
      {
        id: 'chrome-x86',
        name: 'Google Chrome (x86)',
        path: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
      },
      {
        id: 'chrome-beta',
        name: 'Google Chrome Beta',
        path: 'C:\\Program Files\\Google\\Chrome Beta\\Application\\chrome.exe'
      },
      {
        id: 'chrome-canary',
        name: 'Google Chrome Canary',
        path: `${process.env.LOCALAPPDATA}\\Google\\Chrome SxS\\Application\\chrome.exe`
      },
      {
        id: 'edge',
        name: 'Microsoft Edge',
        path: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
      },
      {
        id: 'edge-beta',
        name: 'Microsoft Edge Beta',
        path: 'C:\\Program Files (x86)\\Microsoft\\Edge Beta\\Application\\msedge.exe'
      },
      {
        id: 'edge-dev',
        name: 'Microsoft Edge Dev',
        path: 'C:\\Program Files (x86)\\Microsoft\\Edge Dev\\Application\\msedge.exe'
      },
      {
        id: 'brave',
        name: 'Brave Browser',
        path: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'
      },
      {
        id: 'opera',
        name: 'Opera',
        path: `${process.env.LOCALAPPDATA}\\Programs\\Opera\\opera.exe`
      },
      {
        id: 'vivaldi',
        name: 'Vivaldi',
        path: `${process.env.LOCALAPPDATA}\\Vivaldi\\Application\\vivaldi.exe`
      }
    ]
    
    return browsers
  }
  
  /**
   * Detect browsers on Linux
   */
  private static detectLinuxBrowsers(): BrowserInfo[] {
    const browsers: BrowserInfo[] = [
      {
        id: 'chrome',
        name: 'Google Chrome',
        path: 'google-chrome',
        isDefault: true
      },
      {
        id: 'chrome-stable',
        name: 'Google Chrome Stable',
        path: 'google-chrome-stable'
      },
      {
        id: 'chrome-beta',
        name: 'Google Chrome Beta',
        path: 'google-chrome-beta'
      },
      {
        id: 'chrome-unstable',
        name: 'Google Chrome Unstable',
        path: 'google-chrome-unstable'
      },
      {
        id: 'chromium',
        name: 'Chromium',
        path: 'chromium-browser'
      },
      {
        id: 'chromium-snap',
        name: 'Chromium (Snap)',
        path: '/snap/bin/chromium'
      },
      {
        id: 'edge',
        name: 'Microsoft Edge',
        path: 'microsoft-edge'
      },
      {
        id: 'brave',
        name: 'Brave Browser',
        path: 'brave-browser'
      },
      {
        id: 'opera',
        name: 'Opera',
        path: 'opera'
      },
      {
        id: 'vivaldi',
        name: 'Vivaldi',
        path: 'vivaldi'
      }
    ]
    
    return browsers
  }
  
  /**
   * Check if a browser executable exists
   */
  static browserExists(browserPath: string): boolean {
    try {
      if (process.platform === 'linux' && !path.isAbsolute(browserPath)) {
        // For Linux, check if command exists in PATH
        execSync(`which ${browserPath}`, { stdio: 'ignore' })
        return true
      } else {
        // For absolute paths or Windows/macOS, check file existence
        return fs.existsSync(browserPath)
      }
    } catch {
      return false
    }
  }
  
  /**
   * Get browser version
   */
  private static async getBrowserVersion(browserPath: string): Promise<string> {
    try {
      let versionCommand: string
      
      if (process.platform === 'win32') {
        // Windows: use wmic or reg query
        versionCommand = `"${browserPath}" --version`
      } else if (process.platform === 'darwin') {
        // macOS: use mdls or direct execution
        versionCommand = `"${browserPath}" --version`
      } else {
        // Linux: direct execution
        versionCommand = `${browserPath} --version`
      }
      
      const output = execSync(versionCommand, { 
        encoding: 'utf8', 
        stdio: 'pipe',
        timeout: 5000 
      })
      
      // Extract version number from output (e.g., "Google Chrome 121.0.6167.160")
      const versionMatch = output.match(/[\d.]+/)
      return versionMatch ? versionMatch[0] : 'Unknown'
    } catch (error) {
      console.warn(`Failed to get browser version for ${browserPath}:`, error)
      return 'Unknown'
    }
  }
  
  /**
   * Get the default browser or fall back to the first available
   */
  static async getDefaultBrowser(): Promise<BrowserInfo | null> {
    const browsers = await this.detectBrowsers()
    return browsers.find(b => b.isDefault) || browsers[0] || null
  }
  
  /**
   * Find a browser by ID
   */
  static async findBrowserById(id: string): Promise<BrowserInfo | null> {
    const browsers = await this.detectBrowsers()
    return browsers.find(b => b.id === id) || null
  }
} 