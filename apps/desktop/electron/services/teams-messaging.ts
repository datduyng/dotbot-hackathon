import { logger } from '../utils/logger'
import fetch, { RequestInit } from 'node-fetch'

interface TeamsMessagePayload {
  id: string
  type: string
  conversationid: string
  conversationLink: string
  from: string
  composetime: string
  originalarrivaltime: string
  content: string
  messagetype: string
  contenttype: string
  imdisplayname: string
  clientmessageid: string
  callId: string
  state: number
  version: string
  amsreferences: any[]
  properties: {
    importance: string
    subject: string
    title: string
    cards: string
    links: string
    mentions: string
    onbehalfof: any
    files: string
    policyViolation: any
    formatVariant: string
  }
  crossPostChannels: any[]
}

export class TeamsMessagingService {
  private static instance: TeamsMessagingService

  private constructor() {}

  static getInstance(): TeamsMessagingService {
    if (!TeamsMessagingService.instance) {
      TeamsMessagingService.instance = new TeamsMessagingService()
    }
    return TeamsMessagingService.instance
  }

  async sendMessage(
    conversationId: string, 
    content: string, 
    senderName: string, 
    accessToken: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!accessToken || !accessToken.trim()) {
      const error = 'No access token provided. Teams authentication required.'
      logger.error('Teams message send failed:', error)
      return { success: false, error }
    }

    if (!conversationId || !conversationId.trim()) {
      const error = 'No conversation ID provided.'
      logger.error('Teams message send failed:', error)
      return { success: false, error }
    }

    if (!content || !content.trim()) {
      const error = 'No message content provided.'
      logger.error('Teams message send failed:', error)
      return { success: false, error }
    }

    try {
      logger.info(`Sending Teams message to conversation: ${conversationId}`)
      
      const now = new Date().toISOString()
      const clientMessageId = Date.now().toString() + Math.random().toString().slice(2, 8)

      // Extract user ID from access token or use a default
      const fromUserId = this.extractUserIdFromToken(accessToken) || "8:orgid:5abd413c-e20c-47ac-bcb4-97fc92b11431"

      const payload: TeamsMessagePayload = {
        id: "-1",
        type: "Message",
        conversationid: conversationId,
        conversationLink: `blah/${conversationId}`,
        from: fromUserId,
        composetime: now,
        originalarrivaltime: now,
        content: `<p>${this.escapeHtml(content)}</p>`,
        messagetype: "RichText/Html",
        contenttype: "Text",
        imdisplayname: senderName,
        clientmessageid: clientMessageId,
        callId: "",
        state: 0,
        version: "0",
        amsreferences: [],
        properties: {
          importance: "",
          subject: "",
          title: "",
          cards: "[]",
          links: "[]",
          mentions: "[]",
          onbehalfof: null,
          files: "[]",
          policyViolation: null,
          formatVariant: "TEAMS"
        },
        crossPostChannels: []
      }

      const encodedConversationId = encodeURIComponent(conversationId)
      const apiUrl = `https://teams.microsoft.com/api/chatsvc/amer/v1/users/ME/conversations/${encodedConversationId}/messages`
      
      const requestOptions: RequestInit = {
        method: "POST",
        headers: {
          "authorization": `Bearer ${accessToken}`,
          "behavioroverride": "redirectAs404",
          "clientinfo": "os=mac; osVer=10.15.7; proc=x86; lcid=en-us; deviceType=1; country=us; clientName=skypeteams; clientVer=1415/25050401620; utcOffset=-07:00; timezone=America/Los_Angeles",
          "content-type": "application/json",
          "x-ms-migration": "True",
          "x-ms-request-priority": "0",
          "x-ms-test-user": "False",
          "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        body: JSON.stringify(payload)
      }
      console.log('requestOptions', requestOptions)

      logger.info(`Making Teams API request to: ${apiUrl}`)
      logger.debug(`Request payload:`, JSON.stringify(payload, null, 2))

      const response = await fetch(apiUrl, requestOptions)

      if (!response.ok) {
        const responseText = await response.text()
        const error = `Teams API error: ${response.status} ${response.statusText}. Response: ${responseText}`
        logger.error('Teams message send failed:', error)
        return { success: false, error }
      }

      const responseData = await response.text()
      logger.info('Teams message sent successfully')
      logger.debug('Response data:', responseData)

      return { success: true }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('Failed to send Teams message:', errorMessage)
      logger.error('Error details:', error)
      
      return { 
        success: false, 
        error: `Network error: ${errorMessage}` 
      }
    }
  }

  private extractUserIdFromToken(accessToken: string): string | null {
    try {
      // JWT tokens are base64 encoded and have 3 parts separated by dots
      const parts = accessToken.split('.')
      if (parts.length !== 3) {
        return null
      }

      // Decode the payload (middle part)
      const payload = Buffer.from(parts[1], 'base64').toString('utf-8')
      const tokenData = JSON.parse(payload)
      
      // Look for common user ID fields in Teams JWT tokens
      return tokenData.oid || tokenData.sub || tokenData.unique_name || null
    } catch (error) {
      logger.warn('Failed to extract user ID from token:', error)
      return null
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }
}

export const teamsMessaging = TeamsMessagingService.getInstance() 