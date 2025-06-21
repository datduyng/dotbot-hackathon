import { Tray, Menu, nativeImage, app } from 'electron'
import path from 'node:path'
import { WindowManager } from './window-manager'

export class TrayManager {
  private tray: Tray | null = null
  private isQuitingCallback: () => boolean

  constructor(isQuitingCallback: () => boolean) {
    this.isQuitingCallback = isQuitingCallback
  }

  createTray(windowManager: WindowManager, teamsManager: any): void {
    // Create a simple tray icon
    const trayIcon = nativeImage.createFromPath(
      path.join(process.env.VITE_PUBLIC!, 'electron-vite.svg')
    )
    this.tray = new Tray(trayIcon.resize({ width: 16, height: 16 }))
    
    this.updateTrayMenu(windowManager, teamsManager)
    
    // Double click to show/hide window
    this.tray.on('double-click', () => {
      if (windowManager.getWindow() === null) {
        windowManager.createWindow()
      } else if (windowManager.isWindowVisible()) {
        windowManager.hideWindow()
      } else {
        windowManager.showWindow()
      }
    })
  }

  updateTrayMenu(windowManager?: WindowManager, teamsManager?: any): void {
    if (!this.tray) return

    // If no managers provided, just update with basic menu
    if (!windowManager || !teamsManager) {
      const basicMenu = Menu.buildFromTemplate([
        {
          label: 'Show DotBot',
          enabled: false
        },
        { type: 'separator' },
        {
          label: 'Quit',
          click: () => app.quit()
        }
      ])
      this.tray.setContextMenu(basicMenu)
      return
    }

    const isTeamsActive = teamsManager.isActive()
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show DotBot',
        click: () => {
          windowManager.showWindow()
        }
      },
      {
        label: isTeamsActive ? 'Stop Keep-Alive' : 'Start Keep-Alive',
        click: async () => {
          if (isTeamsActive) {
            await teamsManager.stopChrome()
          } else {
            await teamsManager.startChrome()
          }
          // Update menu after action
          this.updateTrayMenu(windowManager, teamsManager)
        }
      },
      { type: 'separator' },
      {
        label: 'Settings',
        click: () => {
          windowManager.showWindow()
          windowManager.navigateTo('/settings')
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          // Set quitting flag and cleanup
          teamsManager.cleanup()
          app.quit()
        }
      }
    ])
    
    this.tray.setToolTip('Teams Keep-Alive' + (isTeamsActive ? ' - Active' : ' - Inactive'))
    this.tray.setContextMenu(contextMenu)
  }

  destroy(): void {
    if (this.tray) {
      this.tray.destroy()
      this.tray = null
    }
  }
} 