import { TeamsAuthStatus } from '@/types'
import { ipcRenderer, contextBridge } from 'electron'
import { TeamsStatus, UpdateStatus } from 'electron/types'

// Add console logging for preload initialization
console.log('🔧 Preload script starting...')
console.log('Environment:', {
  nodeVersion: process.versions.node,
  electronVersion: process.versions.electron,
  isDev: process.env.NODE_ENV !== 'production'
})

// --------- Expose some API to the Renderer process ---------
try {
  console.log('🔌 Exposing ipcRenderer...')
  contextBridge.exposeInMainWorld('ipcRenderer', {
    on(...args: Parameters<typeof ipcRenderer.on>) {
      const [channel, listener] = args
      return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
    },
    off(...args: Parameters<typeof ipcRenderer.off>) {
      const [channel, ...omit] = args
      return ipcRenderer.off(channel, ...omit)
    },
    send(...args: Parameters<typeof ipcRenderer.send>) {
      const [channel, ...omit] = args
      return ipcRenderer.send(channel, ...omit)
    },
    invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
      const [channel, ...omit] = args
      return ipcRenderer.invoke(channel, ...omit)
    },

    // You can expose other APTs you need here.
    // ...
  })
  console.log('✅ ipcRenderer exposed successfully')
} catch (error) {
  console.error('❌ Failed to expose ipcRenderer:', error)
}

// Expose update-related APIs and all other functionality
try {
  console.log('🔌 Exposing electronAPI...')
  contextBridge.exposeInMainWorld('electronAPI', {
    // Update functions
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    installUpdate: () => ipcRenderer.invoke('install-update'),
    
    // Listen for update status changes
    onUpdateStatus: (callback: (status: UpdateStatus) => void) => {
      ipcRenderer.on('update-status', (_event, status) => callback(status))
    },
    
    // Remove update status listener
    removeUpdateStatusListener: () => {
      ipcRenderer.removeAllListeners('update-status')
    },

    // Navigate to specific routes (for tray menu)
    onNavigateTo: (callback: (route: string) => void) => {
      ipcRenderer.on('navigate-to', (_event, route) => callback(route))
    },

    // Chrome Teams functions
    startChromeTeams: () => ipcRenderer.invoke('start-chrome-teams'),
    stopChromeTeams: () => ipcRenderer.invoke('stop-chrome-teams'),
    getChromeTeamsStatus: () => ipcRenderer.invoke('get-chrome-teams-status'),
    getTeamsAuthStatus: () => ipcRenderer.invoke('get-teams-auth-status'),
    sendTeamsMessage: (conversationId: string, content: string, senderName: string) => ipcRenderer.invoke('send-teams-message', conversationId, content, senderName),

    // Listen for Teams status changes
    onTeamsStatus: (callback: (status: TeamsStatus) => void) => {
      ipcRenderer.on('teams-status', (_event, status) => callback(status))
    },

    // Listen for Teams authentication status
    onTeamsAuthStatus: (callback: (status: TeamsAuthStatus) => void) => {
      ipcRenderer.on('teams-auth-status', (_event, status) => callback(status))
    },

    // Remove Teams listeners
    removeTeamsListeners: () => {
      ipcRenderer.removeAllListeners('teams-status')
      ipcRenderer.removeAllListeners('teams-auth-status')
    },

    // Storage functions
    getOnboardingCompleted: () => ipcRenderer.invoke('get-onboarding-completed'),
    setOnboardingCompleted: (completed: boolean) => ipcRenderer.invoke('set-onboarding-completed', completed),
    getAppSettings: () => ipcRenderer.invoke('get-app-settings'),
    setAppSettings: (settings: any) => ipcRenderer.invoke('set-app-settings', settings),
    getTeamsSettings: () => ipcRenderer.invoke('get-teams-settings'),
    setTeamsSettings: (settings: any) => ipcRenderer.invoke('set-teams-settings', settings),
    
    // User settings functions
    getUserSettings: () => ipcRenderer.invoke('get-user-settings'),
    setUserSettings: (settings: any) => ipcRenderer.invoke('set-user-settings', settings),
    
    // Auto-start functionality
    setAutoStart: (enabled: boolean) => ipcRenderer.invoke('set-auto-start', enabled),
    getAutoStart: () => ipcRenderer.invoke('get-auto-start'),

    // Notification functions
    getNotificationSessions: (limit?: number) => ipcRenderer.invoke('get-notification-sessions', limit),
    getNotificationMessages: (sessionId: string) => ipcRenderer.invoke('get-notification-messages', sessionId),
    markNotificationAsRead: (messageId: string) => ipcRenderer.invoke('mark-notification-as-read', messageId),
    getUnreadNotificationCount: (sessionId?: string) => ipcRenderer.invoke('get-unread-notification-count', sessionId),
    getActiveNotificationSession: () => ipcRenderer.invoke('get-active-notification-session'),

    // Listen for new notifications
    onNewNotification: (callback: (notification: any) => void) => {
      ipcRenderer.on('new-notification', (_event, notification) => callback(notification))
    },

    // Listen for new session creation
    onNewSession: (callback: (session: any) => void) => {
      ipcRenderer.on('new-session-created', (_event, session) => callback(session))
    },

    // Remove notification listeners
    removeNotificationListeners: () => {
      ipcRenderer.removeAllListeners('new-notification')
      ipcRenderer.removeAllListeners('new-session-created')
    },

    // Browser detection and selection functions
    detectBrowsers: () => ipcRenderer.invoke('detect-browsers'),
    getAvailableBrowsers: () => ipcRenderer.invoke('get-available-browsers'),
    getSelectedBrowser: () => ipcRenderer.invoke('get-selected-browser'),
    setSelectedBrowser: (browserId: string) => ipcRenderer.invoke('set-selected-browser', browserId),
    getBrowserSettings: () => ipcRenderer.invoke('get-browser-settings'),

    // AI functions
    getAvailableAIModels: () => ipcRenderer.invoke('ai-get-available-models'),
    getCurrentAIModel: () => ipcRenderer.invoke('ai-get-current-model'),
    isAIModelLoading: () => ipcRenderer.invoke('ai-is-model-loading'),
    downloadAIModel: (modelId: string, sessionId: string) => ipcRenderer.invoke('ai-download-model', modelId, sessionId),
    loadAIModel: (modelId: string) => ipcRenderer.invoke('ai-load-model', modelId),
    summarizeSession: (sessionId: string) => ipcRenderer.invoke('ai-summarize-session', sessionId),
    getAICachePath: () => ipcRenderer.invoke('ai-get-cache-path'),
    saveCurrentAIModel: (modelId: string) => ipcRenderer.invoke('ai-save-current-model', modelId),
    getSavedAIModel: () => ipcRenderer.invoke('ai-get-saved-model'),
    
    // Listen for AI download progress
    onAIDownloadProgress: (callback: (data: { sessionId: string; progress: any }) => void) => {
      ipcRenderer.on('ai-download-progress', (_event, data) => callback(data))
    },

    // Remove AI listeners
    removeAIListeners: () => {
      ipcRenderer.removeAllListeners('ai-download-progress')
    },
  })
  console.log('✅ electronAPI exposed successfully')
} catch (error) {
  console.error('❌ Failed to expose electronAPI:', error)
}

console.log('🎉 Preload script initialization complete')

// --------- Preload scripts loading ---------
function domReady(condition: DocumentReadyState[] = ['complete', 'interactive']) {
  return new Promise(resolve => {
    if (condition.includes(document.readyState)) {
      resolve(true)
    } else {
      document.addEventListener('readystatechange', () => {
        if (condition.includes(document.readyState)) {
          resolve(true)
        }
      })
    }
  })
}

const safeDOM = {
  append(parent: HTMLElement, child: HTMLElement) {
    if (!Array.from(parent.children).find(e => e === child)) {
      return parent.appendChild(child)
    }
  },
  remove(parent: HTMLElement, child: HTMLElement) {
    if (Array.from(parent.children).find(e => e === child)) {
      return parent.removeChild(child)
    }
  },
}

/**
 * https://tobiasahlin.com/spinkit
 * https://connoratherton.com/loaders
 * https://projects.lukehaas.me/css-loaders
 * https://matejkustec.github.io/SpinThatShit
 */
function useLoading() {
  const className = `loaders-css__square-spin`
  const styleContent = `
@keyframes square-spin {
  25% { transform: perspective(100px) rotateX(180deg) rotateY(0); }
  50% { transform: perspective(100px) rotateX(180deg) rotateY(180deg); }
  75% { transform: perspective(100px) rotateX(0) rotateY(180deg); }
  100% { transform: perspective(100px) rotateX(0) rotateY(0); }
}
.${className} > div {
  animation-fill-mode: both;
  width: 50px;
  height: 50px;
  background: #fff;
  animation: square-spin 3s 0s cubic-bezier(0.09, 0.57, 0.49, 0.9) infinite;
}
.app-loading-wrap {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #282c34;
  z-index: 9;
}
    `
  const oStyle = document.createElement('style')
  const oDiv = document.createElement('div')

  oStyle.id = 'app-loading-style'
  oStyle.innerHTML = styleContent
  oDiv.className = 'app-loading-wrap'
  oDiv.innerHTML = `<div class="${className}"><div></div></div>`

  return {
    appendLoading() {
      safeDOM.append(document.head, oStyle)
      safeDOM.append(document.body, oDiv)
    },
    removeLoading() {
      safeDOM.remove(document.head, oStyle)
      safeDOM.remove(document.body, oDiv)
    },
  }
}

// ----------------------------------------------------------------------

const { appendLoading, removeLoading } = useLoading()
domReady().then(appendLoading)

window.onmessage = (ev) => {
  ev.data.payload === 'removeLoading' && removeLoading()
}

setTimeout(removeLoading, 1000)