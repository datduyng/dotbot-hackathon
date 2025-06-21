import { BrowserWindow, app, dialog } from 'electron'
import electronUpdater from 'electron-updater'

const { autoUpdater } = electronUpdater

export class AutoUpdaterManager {
  private window: BrowserWindow | null = null

  setup(window: BrowserWindow): void {
    this.window = window

    // Configure auto-updater for production only
    if (app.isPackaged) {
      this.configureAutoUpdater()
      this.setupEventHandlers()
      
      // Check for updates after window is ready (delayed)
      setTimeout(() => {
        autoUpdater.checkForUpdatesAndNotify()
      }, 3000) // Wait 3 seconds after app starts
    } else {
      console.log('Auto-updater disabled in development mode')
    }
  }

  private configureAutoUpdater(): void {
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'datduyng',
      repo: 'dotbot-releases'
    })
    
    // Enable logging for debugging
    autoUpdater.logger = console
  }

  private setupEventHandlers(): void {
    autoUpdater.on('checking-for-update', () => {
      console.log('Checking for update...')
      this.sendUpdateStatus({
        status: 'checking',
        message: 'Checking for updates...'
      })
    })

    autoUpdater.on('update-available', (info) => {
      console.log('Update available:', info)
      this.sendUpdateStatus({
        status: 'available',
        message: 'Update available. Downloading...',
        info
      })
    })

    autoUpdater.on('update-not-available', (info) => {
      console.log('Update not available:', info)
      this.sendUpdateStatus({
        status: 'not-available',
        message: 'You are running the latest version.',
        info
      })
    })

    autoUpdater.on('error', (err) => {
      console.log('Error in auto-updater:', err)
      this.sendUpdateStatus({
        status: 'error',
        message: 'Error checking for updates.',
        error: err.message
      })
    })

    autoUpdater.on('download-progress', (progressObj) => {
      const log_message = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`
      console.log(log_message)
      this.sendUpdateStatus({
        status: 'downloading',
        message: `Downloading update: ${Math.round(progressObj.percent)}%`,
        progress: progressObj
      })
    })

    autoUpdater.on('update-downloaded', (info) => {
      console.log('Update downloaded:', info)
      this.sendUpdateStatus({
        status: 'downloaded',
        message: 'Update downloaded. Will install on restart.',
        info
      })
      
      this.showInstallDialog()
    })
  }

  private sendUpdateStatus(status: any): void {
    this.window?.webContents.send('update-status', status)
  }

  private async showInstallDialog(): Promise<void> {
    if (!this.window) return

    const result = await dialog.showMessageBox(this.window, {
      type: 'info',
      buttons: ['Install Now', 'Install Later'],
      defaultId: 0,
      title: 'Update Downloaded',
      message: 'A new version has been downloaded.',
      detail: 'The update will be installed the next time you restart the application. Would you like to restart now?'
    })

    if (result.response === 0) {
      // User chose to install now
      autoUpdater.quitAndInstall()
    }
  }

  async checkForUpdates(): Promise<any> {
    if (!app.isPackaged) {
      return { status: 'dev-mode', message: 'Updates are not available in development mode.' }
    }
    
    try {
      const result = await autoUpdater.checkForUpdates()
      return { status: 'success', result }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('Manual update check failed:', errorMessage)
      return { status: 'error', error: errorMessage }
    }
  }

  installUpdate(): void {
    autoUpdater.quitAndInstall()
  }
} 