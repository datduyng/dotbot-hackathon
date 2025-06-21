import { BrowserWindow } from 'electron'
import { storage } from '../storage'
import { extractTextFromHtml, generateMessageId } from '../utils/helpers'
import { NotificationSession, NotificationMessage } from '../types'
import type { Page, CDPSession } from 'puppeteer-core'
import fs from 'fs'

export class NotificationManager {
  private window: BrowserWindow | null = null
  private currentNotificationSession: string | null = null
  private isMonitoringNotifications = false
  private chromePage: Page & { _cdpClient?: CDPSession | null } | null = null // Will be set by TeamsManager
  private activeCDPSessions: Set<CDPSession> = new Set() // Track all active sessions

  setWindow(window: BrowserWindow): void {
    this.window = window
  }

  setChromePage(chromePage: Page): void {
    // Attach _cdpClient property for cleanup, as in original code
    this.chromePage = chromePage as Page & { _cdpClient?: CDPSession | null }
  }

  async startMonitoring(): Promise<void> {
    if (!this.chromePage || this.isMonitoringNotifications) return

    console.log('🔔 Starting notification monitoring...')

    try {
      // Create a new notification session
      this.currentNotificationSession = await storage.createNotificationSession()
      console.log('📝 Created notification session:', this.currentNotificationSession)

      // Notify the UI about the new session
      this.window?.webContents.send('new-session-created', {
        sessionId: this.currentNotificationSession
      })

      // Setup CDP monitoring
      await this.setupCDPNotitificationMonitoring()

      this.isMonitoringNotifications = true
      console.log('✅ Notification monitoring started with CDP')

    } catch (error) {
      console.error('❌ Failed to start notification monitoring:', error)
    }
  }

  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoringNotifications) return

    console.log('🛑 Stopping notification monitoring...')

    try {
      // Cleanup all CDP sessions
      for (const session of this.activeCDPSessions) {
        try {
          await session.detach()
        } catch (error) {
          console.error('Error detaching CDP session:', error)
        }
      }
      this.activeCDPSessions.clear()

      // Cleanup main CDP session
      if (this.chromePage && this.chromePage._cdpClient) {
        try {
          await this.chromePage._cdpClient.detach()
          this.chromePage._cdpClient = null
        } catch (error) {
          console.error('Error detaching main CDP client:', error)
        }
      }

      // End the current session
      if (this.currentNotificationSession) {
        await storage.endNotificationSession(this.currentNotificationSession)
        console.log('📝 Ended notification session:', this.currentNotificationSession)
        this.currentNotificationSession = null
      }

      this.isMonitoringNotifications = false
      console.log('✅ Notification monitoring stopped')

    } catch (error) {
      console.error('❌ Error stopping notification monitoring:', error)
    }
  }

  async cleanup(): Promise<void> {
    await this.stopMonitoring()
  }

  private async setupCDPNotitificationMonitoring(): Promise<void> {
    if (!this.chromePage || !this.currentNotificationSession) return

    try {
      console.log('🔔 Setting up CDP notification monitoring...')

      // Create CDP session
      const client: CDPSession = await this.chromePage.target().createCDPSession()

      // Setup auto-attach to capture all targets (including service workers, iframes, and web workers)
      await client.send('Target.setAutoAttach', {
        autoAttach: true,
        flatten: true,
        waitForDebuggerOnStart: true,
        filter: [
          // { type: 'page' },
          // { type: 'service_worker' },
          { type: 'worker' },  // This is key for web workers!
          // { type: 'shared_worker' }
        ]
      })

      // Monitor target creation to see what types of targets are being created
      await client.send('Target.setDiscoverTargets', { discover: true })
      client.on('Target.targetCreated', (params: { targetInfo: { type: string, url: string, targetId: string } }) => {
        const { targetInfo } = params
        console.log(`🎯 New target created - Type: ${targetInfo.type}, URL: ${targetInfo.url}, ID: ${targetInfo.targetId}`)
        
        if (targetInfo.type === 'service_worker') {
          console.log('🔧 Service worker detected! This might handle WebSocket connections.')
        } else if (targetInfo.type === 'worker') {
          console.log('👷 Web worker detected! This might handle WebSocket connections.')
          console.log('🔍 Worker URL:', targetInfo.url)
        } else if (targetInfo.type === 'shared_worker') {
          console.log('🤝 Shared worker detected! This might handle WebSocket connections.')
        }
      })

      // Also listen for target info changes
      client.on('Target.targetInfoChanged', (params: { targetInfo: { type: string, url: string, targetId: string } }) => {
        const { targetInfo } = params
        if (targetInfo.type === 'worker' && targetInfo.url.includes('precompiled-web-worker')) {
          console.log('🎯 Teams web worker detected:', targetInfo.url)
        }
      })

      // Function to subscribe to WebSocket events for a session
      const subscribeToSession = async (session: CDPSession) => {
        try {
          // Track this session for cleanup
          this.activeCDPSessions.add(session)
          console.log('📊 Total active CDP sessions:', this.activeCDPSessions.size)

          // Handle new session attachments (for service workers, iframes, etc.)
          session.on('sessionattached', (attachedSession: CDPSession) => {
            console.log('🔗 New session attached, subscribing to WebSocket events')
            subscribeToSession(attachedSession)
          })

          // Also handle Target.attachedToTarget events
          session.on('Target.attachedToTarget', (params: any) => {
            const { targetInfo, sessionId } = params
            console.log(`🎯 Target attached - Type: ${targetInfo.type}, URL: ${targetInfo.url}, SessionID: ${sessionId}`)
            
            if (targetInfo.type === 'worker' && targetInfo.url.includes('precompiled-web-worker')) {
              console.log('🔧 Teams web worker attached! This should now capture WebSocket events.')
            }
          })

          // Enable network domain to monitor WebSocket frames
          await session.send('Network.enable')
          console.log('🌐 Network domain enabled for session')

          // Also enable Runtime domain for web workers
          try {
            await session.send('Runtime.enable')
            console.log('⚡ Runtime domain enabled for session')
          } catch (error) {
            // Runtime domain might not be available for all target types
            console.log('ℹ️ Runtime domain not available for this session type')
          }

          // Listen for WebSocket frames
          session.on('Network.webSocketFrameReceived', async (params: any) => {
            try {
              const { response, requestId } = params
              const payloadData = response?.payloadData

              // Check if this is a Teams notification WebSocket
              if (payloadData && typeof payloadData === 'string') {
                console.log('📨 WebSocket frame received from target - RequestID:', requestId)
                console.log('📨 Frame preview:', payloadData.substring(0, 100) + '...')
                await this.processWebSocketMessage(payloadData)
              }
            } catch (error) {
              console.error('❌ Error processing WebSocket frame via CDP:', error)
            }
          })

          // Listen for WebSocket frame sent (outgoing)
          session.on('Network.webSocketFrameSent', async (params: any) => {
            try {
              const { request, requestId } = params
            } catch (error) {
              console.error('❌ Error logging WebSocket frame sent:', error)
            }
          })

          // Monitor WebSocket creation
          session.on('Network.webSocketCreated', (params: any) => {
            const { url, requestId } = params
            console.log('🔌 WebSocket created - URL:', url, 'RequestID:', requestId)
            if (url.includes('trouter.teams.microsoft.com')) {
              console.log('🎯 Teams WebSocket connection established!')
            }
          })

          // Monitor WebSocket closure
          session.on('Network.webSocketClosed', (params: any) => {
            const { requestId } = params
            console.log('🔌 WebSocket closed - RequestID:', requestId)
          })

          // Also monitor network requests for WebSocket connections
          session.on('Network.requestWillBeSent', (params: any) => {
            const { request, requestId } = params
            if (request.url && request.url.includes('trouter.teams.microsoft.com')) {
              console.log('🌐 Teams WebSocket connection detected via CDP - URL:', request.url, 'RequestID:', requestId)
            }
          })

          // Resume execution if waiting for debugger
          await session.send('Runtime.runIfWaitingForDebugger')

        } catch (error) {
          console.error('❌ Error subscribing to session:', error)
          // Remove failed session from tracking
          this.activeCDPSessions.delete(session)
        }
      }

      // Subscribe to the main session
      await subscribeToSession(client)

      // Also try to discover and attach to existing targets
      try {
        const targets = await client.send('Target.getTargets')
        console.log('🔍 Discovered existing targets:', targets.targetInfos?.length || 0)
        
        for (const targetInfo of targets.targetInfos || []) {
          console.log(`📋 Existing target - Type: ${targetInfo.type}, URL: ${targetInfo.url}`)
          
          if (targetInfo.type === 'worker' && targetInfo.url.includes('precompiled-web-worker')) {
            console.log('🎯 Found existing Teams web worker, attempting to attach...')
            try {
              const attachResult = await client.send('Target.attachToTarget', {
                targetId: targetInfo.targetId,
                flatten: true
              })
              console.log('✅ Successfully attached to Teams web worker:', attachResult.sessionId)
            } catch (error) {
              console.error('❌ Failed to attach to Teams web worker:', error)
            }
          }
        }
      } catch (error) {
        console.error('❌ Error discovering existing targets:', error)
      }

      console.log('✅ CDP notification monitoring setup complete with multi-target support')

      // Store the client for cleanup
      if (!this.chromePage._cdpClient) {
        this.chromePage._cdpClient = client
      }

    } catch (error) {
      console.error('❌ Failed to setup CDP notification monitoring:', error)
    }
  }

  private async processWebSocketMessage(payloadData: string): Promise<void> {
    // Skip SignalR ping messages (type 5)
    if (payloadData.startsWith('5:')) {
      return; // This is just a keep-alive ping
    }

    // Extract JSON payload from the first '{' to the end
    const jsonStart = payloadData.indexOf('{');
    if (jsonStart !== -1) {
      const payload = payloadData.substring(jsonStart);
      await this.processNotificationPayload(payload);
    }
  }

  // write message to file 
  private async writeMessageToFile(message: string): Promise<void> {
    const timestamp = new Date().toISOString()
    const filename = `notification-${timestamp}.json`
    fs.writeFileSync(filename, message)
    console.log(`📝 Wrote message to file: ${filename}`)
  }

  private async processNotificationPayload(payload: string): Promise<void> {
    if (!payload) return;
    
    try {
      const messageData = JSON.parse(payload)

      // Check if this matches the notification pattern
      if (messageData.url
        && messageData.url.includes('v4/f')
        && messageData.url.endsWith('/messaging')
        && messageData.body
        && messageData.method == "POST") {
        console.log('🔔 Detected Teams notification via CDP');

        // await this.writeMessageToFile(payload);
        // Parse the body if it exists
        if (messageData.body) {
          let notificationBody
          try {
            notificationBody = JSON.parse(messageData.body)
          } catch (e) {
            console.error('Failed to parse notification body:', e)
            return
          }

          const dontContains = [
            "Event", "Call", "ThreadActivity", "MemberConsumptionHorizonUpdate"
          ]
          
          // Extract notification details
          if (notificationBody.resource
            && notificationBody.type == "EventMessage"
            && notificationBody.resourceType == "NewMessage"
            && notificationBody.resource.content
            && this.currentNotificationSession
            && notificationBody.resource.messageType
            // skip event, call, thread activity
            && !dontContains.some(type => notificationBody.resource.messageType.includes(type))) {
            const notification = {
              id: notificationBody.resource.id || generateMessageId(),
              sessionId: this.currentNotificationSession,
              timestamp: notificationBody.time || new Date().toISOString(),
              from: notificationBody.resource.imdisplayname || 'Unknown',
              content: extractTextFromHtml(notificationBody.resource.content),
              conversationId: notificationBody.resource.to || '',
              conversationName: notificationBody.resource.threadtopic || '',
              messageType: notificationBody.resource.messagetype || 'Text',
              isRead: false
            }
            
            // Store the notification
            await storage.addNotificationMessage(this.currentNotificationSession, notification)
            console.log('💾 Stored Teams notification from:', notification.from)
            
            // Notify the UI
            this.window?.webContents.send('new-notification', notification)
          }
        }
      }
    } catch (error) {
      // Not valid JSON payload, skip silently
    }
  }

  // Public methods for external access to notification data
  async getNotificationSessions(limit?: number): Promise<NotificationSession[]> {
    return await storage.getNotificationSessions(limit)
  }

  async getNotificationMessages(sessionId: string): Promise<NotificationMessage[]> {
    return await storage.getNotificationMessages(sessionId)
  }

  async markNotificationAsRead(messageId: string) {
    return await storage.markNotificationAsRead(messageId)
  }

  async getUnreadNotificationCount(sessionId?: string) {
    return await storage.getUnreadNotificationCount(sessionId)
  }

  async getActiveNotificationSession() {
    return await storage.getActiveNotificationSession()
  }
} 