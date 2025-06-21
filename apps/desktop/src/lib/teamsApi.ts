export class TeamsApiService {
  private static instance: TeamsApiService

  private constructor() {}

  static getInstance(): TeamsApiService {
    if (!TeamsApiService.instance) {
      TeamsApiService.instance = new TeamsApiService()
    }
    return TeamsApiService.instance
  }

  async sendMessage(conversationId: string, content: string, senderName: string): Promise<boolean> {
    // Always use electron API for Teams messaging to avoid CORS issues
    if (window.electronAPI?.sendTeamsMessage) {
      try {
        const result = await window.electronAPI.sendTeamsMessage(conversationId, content, senderName)
        if (result.success) {
          return true
        } else {
          throw new Error(result.error || 'Failed to send message via Teams API')
        }
      } catch (error) {
        console.error('Failed to send via electron API:', error)
        throw error
      }
    }

    // Fallback error if electron API is not available
    throw new Error('Teams messaging not available. Please ensure the application is running in Electron mode.')
  }

  // Method to initialize (no longer needed for token management since it's handled in main process)
  async initializeToken(): Promise<boolean> {
    try {
      // Check if electron API is available and Teams is authenticated
      if (window.electronAPI?.getTeamsAuthStatus) {
        const authStatus = await window.electronAPI.getTeamsAuthStatus()
        return authStatus.authenticated
      }

      console.warn('Teams authentication status check not available')
      return false
    } catch (error) {
      console.error('Failed to check Teams authentication:', error)
      return false
    }
  }
}

export const teamsApi = TeamsApiService.getInstance() 