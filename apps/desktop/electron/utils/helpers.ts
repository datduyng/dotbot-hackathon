import { BrowserDetector } from './browser-detector'
import { storage } from '../storage'

/**
 * Extract text content from HTML string
 */
export function extractTextFromHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
    .replace(/&amp;/g, '&') // Replace &amp; with &
    .replace(/&lt;/g, '<') // Replace &lt; with <
    .replace(/&gt;/g, '>') // Replace &gt; with >
    .replace(/&quot;/g, '"') // Replace &quot; with "
    .replace(/&#39;/g, "'") // Replace &#39; with '
    .trim()
}

/**
 * Get Chrome executable path based on platform with browser selection support
 */
export async function getChromePath(): Promise<string> {
  try {
    // Get selected browser from storage
    const selectedBrowserId = await storage.getSelectedBrowser()
    
    if (selectedBrowserId) {
      // Try to use the selected browser
      const selectedBrowser = await BrowserDetector.findBrowserById(selectedBrowserId)
      if (selectedBrowser && BrowserDetector.browserExists(selectedBrowser.path)) {
        console.log(`Using selected browser: ${selectedBrowser.name} (${selectedBrowser.path})`)
        return selectedBrowser.path
      } else {
        console.warn(`Selected browser ${selectedBrowserId} is no longer available, falling back to default`)
      }
    }
    
    // Fall back to default browser
    const defaultBrowser = await BrowserDetector.getDefaultBrowser()
    if (defaultBrowser) {
      console.log(`Using default browser: ${defaultBrowser.name} (${defaultBrowser.path})`)
      // Update storage with the fallback choice
      await storage.setSelectedBrowser(defaultBrowser.id)
      return defaultBrowser.path
    }
    
    // Ultimate fallback to legacy logic
    console.warn('No Chromium browsers detected, using legacy fallback')
    return getLegacyChromePath()
  } catch (error) {
    console.error('Error getting Chrome path:', error)
    return getLegacyChromePath()
  }
}

/**
 * Legacy Chrome path detection (kept as fallback)
 */
function getLegacyChromePath(): string {
  if (process.platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  } else if (process.platform === 'win32') {
    return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  } else {
    return 'google-chrome'
  }
}

/**
 * Generate Chrome launch arguments for Teams compatibility
 */
export function getChromeArgs(userDataDir: string): string[] {
  return [
    // Essential WebAuthn and security features
    '--enable-features=WebAuthentication,WebBluetoothScanning,WebHID',
    '--enable-web-bluetooth',
    '--enable-experimental-web-platform-features',
    
    // Performance and compatibility
    '--disable-blink-features=AutomationControlled',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    
    // Window settings
    '--window-size=1200,800',
    '--start-maximized',
    
    // Network and DNS
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-sync',
    
    // Remove automation detection
    '--disable-automation',
    '--disable-infobars',
    '--disable-extensions',
    
    // Allow modern web features
    '--enable-modern-media-controls',
    '--allow-running-insecure-content',

    // DevTools
    '--enable-devtools-discovery',
    '--auto-open-devtools-for-tabs',
    
    // User data directory
    `--user-data-dir=${userDataDir}`
  ]
}

/**
 * Get realistic user agent string
 */
export function getUserAgent(): string {
  return 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
}

/**
 * Get HTTP headers for better compatibility
 */
export function getHttpHeaders(): Record<string, string> {
  return {
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-User': '?1',
    'Sec-Fetch-Dest': 'document'
  }
}

/**
 * Generate unique message ID
 */
export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Delay execution for specified milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
} 