import { useState, useEffect, useCallback } from 'react'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Chrome, Settings, Bell, Bot, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import TeamsController from '../components/TeamsController'
// import { AIModelModal } from '../components/ui/ai-model-modal'
import { SummaryModal } from '../components/ui/summary-modal'
import MissedNotifications from '../components/MissedNotifications'
import { teamsApi } from '../lib/teamsApi'

interface NotificationMessage {
  id: string
  sessionId: string
  timestamp: string
  from: string
  content: string
  conversationId: string
  conversationName?: string
  messageType: string
  isRead: boolean
}

interface NotificationSession {
  id: string
  startTime: string
  endTime?: string
  isActive: boolean
  messageCount: number
}

export default function Notifications() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<NotificationSession[]>([])
  const [selectedSession, setSelectedSession] = useState<string | null>(null)
  const [messages, setMessages] = useState<NotificationMessage[]>([])
  const [allMessages, setAllMessages] = useState<NotificationMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  
  // AI-related state
  const [showAIModal, setShowAIModal] = useState(false)
  const [showSummaryModal, setShowSummaryModal] = useState(false)
  const [currentModel, setCurrentModel] = useState<string | null>(null)
  const [isModelLoading, setIsModelLoading] = useState(false)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [currentSummary, setCurrentSummary] = useState<string | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [summarizingSession, setSummarizingSession] = useState<string | null>(null)

  const loadNotificationSessions = useCallback(async () => {
    try {
      const sessionData = await window.electronAPI.getNotificationSessions(10)
      setSessions(sessionData)
      
      // Auto-select the most recent session if none selected
      if (!selectedSession && sessionData.length > 0) {
        setSelectedSession(sessionData[0].id)
      }
    } catch (error) {
      console.error('Failed to load notification sessions:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedSession])

  const loadMessages = useCallback(async (sessionId: string) => {
    try {
      const messageData = await window.electronAPI.getNotificationMessages(sessionId)
      setMessages(messageData)
    } catch (error) {
      console.error('Failed to load notification messages:', error)
    }
  }, [])

  const loadAllMessages = useCallback(async () => {
    try {
      // Load messages from all sessions for the missed notifications component
      const allMessagesData: NotificationMessage[] = []
      
      for (const session of sessions) {
        const sessionMessages = await window.electronAPI.getNotificationMessages(session.id)
        allMessagesData.push(...sessionMessages)
      }
      
      setAllMessages(allMessagesData)
    } catch (error) {
      console.error('Failed to load all messages:', error)
    }
  }, [sessions])

  const loadUnreadCount = useCallback(async () => {
    try {
      const count = await window.electronAPI.getUnreadNotificationCount()
      setUnreadCount(count)
    } catch (error) {
      console.error('Failed to load unread count:', error)
    }
  }, [])

  const loadCurrentAIModel = useCallback(async () => {
    try {
      // Load current model from the AI service
      const model = await window.electronAPI.getCurrentAIModel()
      setCurrentModel(model)
      
      // Also check if there's a saved model preference
      if (!model) {
        const savedModel = await window.electronAPI.getSavedAIModel()
        if (savedModel) {
          // Try to load the saved model if it's downloaded
          const models = await window.electronAPI.getAvailableAIModels()
          const savedModelInfo = models.find(m => m.modelId === savedModel)
          if (savedModelInfo && savedModelInfo.isDownloaded) {
            try {
              await window.electronAPI.loadAIModel(savedModel)
              setCurrentModel(savedModel)
            } catch (error) {
              console.error('Failed to load saved model:', error)
            }
          }
        }
      }
      
      const loading = await window.electronAPI.isAIModelLoading()
      setIsModelLoading(loading)
    } catch (error) {
      console.error('Failed to load current AI model:', error)
    }
  }, [])

  const handleNewNotification = useCallback((notification: NotificationMessage) => {
    console.log('New notification received:', notification)
    // Refresh data when new notification arrives
    loadNotificationSessions()
    loadUnreadCount()
    
    // If viewing the active session, refresh messages
    if (selectedSession === notification.sessionId) {
      loadMessages(notification.sessionId)
    }
  }, [selectedSession, loadNotificationSessions, loadUnreadCount, loadMessages])

  const handleNewSession = useCallback((session: { sessionId: string }) => {
    console.log('New session created:', session)
    // Add a small delay to ensure database transaction is complete
    setTimeout(() => {
      // Refresh sessions list when new session is created
      loadNotificationSessions()
      
      // Always auto-select the new session when it's created
      setSelectedSession(session.sessionId)
    }, 100)
  }, [loadNotificationSessions])

  useEffect(() => {
    loadNotificationSessions()
    loadUnreadCount()
    loadCurrentAIModel()
    
    // Initialize Teams API token
    teamsApi.initializeToken()

    // Listen for new notifications and sessions
    window.electronAPI.onNewNotification(handleNewNotification)
    window.electronAPI.onNewSession(handleNewSession)

    return () => {
      window.electronAPI.removeNotificationListeners()
    }
  }, [handleNewNotification, handleNewSession, loadNotificationSessions, loadUnreadCount, loadCurrentAIModel])

  useEffect(() => {
    if (selectedSession) {
      loadMessages(selectedSession)
    }
  }, [selectedSession, loadMessages])

  useEffect(() => {
    if (sessions.length > 0) {
      loadAllMessages()
    }
  }, [sessions, loadAllMessages])

  const markAsRead = async (messageId: string) => {
    try {
      await window.electronAPI.markNotificationAsRead(messageId)
      // Refresh messages and unread count
      if (selectedSession) {
        loadMessages(selectedSession)
      }
      loadUnreadCount()
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

  const handleSummarizeSession = async (sessionId: string) => {
    // if (!currentModel) {
    //   setShowAIModal(true)
    //   return
    // }

    try {
      setSummaryError(null)
      setSummaryLoading(true)
      setSummarizingSession(sessionId)
      
      const summary = await window.electronAPI.summarizeSession(sessionId)
      setCurrentSummary(summary)
      setShowSummaryModal(true)
    } catch (error) {
      console.error('Failed to summarize session:', error)
      setSummaryError(error instanceof Error ? error.message : 'Failed to generate summary')
      setShowSummaryModal(true)
    } finally {
      setSummaryLoading(false)
      setSummarizingSession(null)
    }
  }

  const handleModelSelected = async (modelId: string) => {
    setCurrentModel(modelId)
    setShowAIModal(false)
    
    // Save the model selection to storage
    try {
      await window.electronAPI.saveCurrentAIModel(modelId)
    } catch (error) {
      console.error('Failed to save model selection:', error)
    }
    
    loadCurrentAIModel() // Refresh the model state
  }

  const handleQuickReply = async (conversationId: string, message: string, userName: string) => {
    try {
      console.log(`Sending quick reply to ${userName} in ${conversationId}: ${message}`)
      
      const success = await teamsApi.sendMessage(conversationId, message, 'You') // 'You' represents the current user
      
      if (success) {
        console.log('Quick reply sent successfully')
        // Refresh all messages and unread count
        loadAllMessages()
        loadUnreadCount()
        
        // Also refresh current session messages if viewing one
        if (selectedSession) {
          loadMessages(selectedSession)
        }
      } else {
        console.error('Failed to send quick reply')
        throw new Error('Failed to send message via Teams API')
      }
    } catch (error) {
      console.error('Error sending quick reply:', error)
      // Re-throw the error so the MissedNotifications component can show proper feedback
      throw error
    }
  }

  const getCurrentSessionInfo = () => {
    if (!selectedSession) return undefined
    const session = sessions.find(s => s.id === selectedSession)
    return session ? {
      id: session.id,
      startTime: session.startTime,
      endTime: session.endTime,
      messageCount: session.messageCount
    } : undefined
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
  }

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime)
    const end = endTime ? new Date(endTime) : new Date()
    const duration = Math.round((end.getTime() - start.getTime()) / 1000 / 60) // minutes
    return `${duration} min`
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background text-foreground">
        <div className="text-center">
          <div className="mx-auto mb-4 w-8 h-8 rounded-full border-b-2 animate-spin border-primary"></div>
          <p className="text-muted-foreground">Loading notifications...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <div className="flex items-center mb-4 space-x-2">
            <Chrome className="w-6 h-6" />
            <h1 className="text-3xl font-bold">Teams Keep-Alive</h1>
          </div>

          {/* Navigation */}
          <div className="flex mb-6 space-x-4">
            <Button 
              variant="default"
              className="bg-primary text-primary-foreground"
            >
              <Chrome className="mr-2 w-4 h-4" />
              Home
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate('/settings')}
            >
              <Settings className="mr-2 w-4 h-4" />
              Settings
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowAIModal(true)}
            >
              <Bot className="mr-2 w-4 h-4" />
              AI Models
              {currentModel && <Badge variant="secondary" className="ml-2 text-xs">Ready</Badge>}
            </Button>
          </div>

          {/* Teams Controller at the top */}
          <div className="mb-8">
            <TeamsController onSessionUpdate={loadNotificationSessions} />
          </div>

          <h2 className="mb-2 text-2xl font-bold">Missed Notifications</h2>
          <p className="text-muted-foreground">
            Review messages you received while away from your desk
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount} unread
              </Badge>
            )}
          </p>
        </div>

        {/* Missed Notifications Section */}
        <MissedNotifications 
          messages={allMessages} 
          onQuickReply={handleQuickReply}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Sessions List */}
          <div className="lg:col-span-1">
            <h2 className="mb-4 text-xl font-semibold">Away Sessions</h2>
            <div className="space-y-2">
              {sessions.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <p>No away sessions yet</p>
                  <p className="mt-2 text-sm">
                    Start Chrome Teams to begin monitoring notifications
                  </p>
                </div>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedSession === session.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedSession(session.id)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-medium">
                        {formatTimestamp(session.startTime)}
                      </span>
                      <div className="flex items-center space-x-1">
                        {session.isActive && (
                          <Badge variant="secondary">Active</Badge>
                        )}
                      </div>
                    </div>
                    <div className="mb-3 text-sm text-muted-foreground">
                      <p>Duration: {formatDuration(session.startTime, session.endTime)}</p>
                      <p>Messages: {session.messageCount}</p>
                    </div>
                    
                    {/* Summarize Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSummarizeSession(session.id)
                      }}
                      disabled={
                        summaryLoading && summarizingSession === session.id ||
                        isModelLoading ||
                        session.messageCount === 0
                      }
                    >
                      {summaryLoading && summarizingSession === session.id ? (
                        <>
                          <div className="mr-2 w-3 h-3 rounded-full border border-current animate-spin border-t-transparent"></div>
                          Summarizing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-1 w-3 h-3" />
                          Summarize
                        </>
                      )}
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Messages List */}
          <div className="lg:col-span-2">
            <h2 className="mb-4 text-xl font-semibold">
              {selectedSession ? 'Messages' : 'Select a session'}
            </h2>
            
            {selectedSession ? (
              <div className="space-y-4">
                {messages.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <p>No messages in this session</p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`p-4 rounded-lg border ${
                        message.isRead 
                          ? 'border-border bg-background' 
                          : 'border-primary bg-primary/5'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-medium">{message.from}</span>
                          {message.conversationName && (
                            <span className="ml-2 text-sm text-muted-foreground">
                              in {message.conversationName}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2 items-center">
                          <span className="text-sm text-muted-foreground">
                            {formatTimestamp(message.timestamp)}
                          </span>
                          {!message.isRead && (
                            <button
                              onClick={() => markAsRead(message.id)}
                              className="px-2 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/80"
                            >
                              Mark Read
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="text-sm">
                        <p>{message.content}</p>
                      </div>
                      <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
                        <span>Type: {message.messageType}</span>
                        {!message.isRead && (
                          <Badge variant="destructive" className="text-xs">
                            Unread
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <p>Select an away session to view messages</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Model Modal */}
      {/* <AIModelModal
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
        onModelSelected={handleModelSelected}
      /> */}

      {/* Summary Modal */}
      <SummaryModal
        isOpen={showSummaryModal}
        onClose={() => {
          setShowSummaryModal(false)
          setCurrentSummary(null)
          setSummaryError(null)
        }}
        summary={currentSummary}
        sessionInfo={getCurrentSessionInfo()}
        isLoading={summaryLoading}
        error={summaryError}
      />
    </div>
  )
} 