import { useState, useEffect, useCallback } from 'react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Clock, Send, User, CheckCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'

interface MissedUser {
  id: string
  name: string
  conversationId: string
  lastMessageTime: string
  messageCount: number
  conversationName?: string
}

interface MissedNotificationsProps {
  messages: any[]
  onQuickReply: (conversationId: string, message: string, userName: string) => Promise<void>
}

export default function MissedNotifications({ messages, onQuickReply }: MissedNotificationsProps) {
  const [missedUsers, setMissedUsers] = useState<MissedUser[]>([])
  const [loading, setLoading] = useState(false)
  const [replyStatus, setReplyStatus] = useState<{ [key: string]: 'success' | 'error' | null }>({})
  const [isExpanded, setIsExpanded] = useState(false)

  // Process messages to extract unique users who need responses
  const processMissedMessages = useCallback(() => {
    const userMap = new Map<string, MissedUser>()

    messages
      .filter(msg => !msg.isRead) // Only unread messages
      .forEach(msg => {
        const userId = msg.from
        const existing = userMap.get(userId)

        if (existing) {
          // Update with latest message time and increment count
          if (new Date(msg.timestamp) > new Date(existing.lastMessageTime)) {
            existing.lastMessageTime = msg.timestamp
          }
          existing.messageCount += 1
        } else {
          // Create new entry
          userMap.set(userId, {
            id: userId,
            name: msg.from,
            conversationId: msg.conversationId,
            lastMessageTime: msg.timestamp,
            messageCount: 1,
            conversationName: msg.conversationName
          })
        }
      })

    const uniqueUsers = Array.from(userMap.values())
      .sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime())
      .slice(0, 10) // Show max 5 users

    setMissedUsers(uniqueUsers)
  }, [messages])

  useEffect(() => {
    processMissedMessages()
  }, [processMissedMessages])

  const handleQuickReply = async (user: MissedUser, message: string) => {
    setLoading(true)
    setReplyStatus(prev => ({ ...prev, [user.id]: null }))

    try {
      await onQuickReply(user.conversationId, message, user.name)
      setReplyStatus(prev => ({ ...prev, [user.id]: 'success' }))

      // Clear success status after 3 seconds
      setTimeout(() => {
        setReplyStatus(prev => ({ ...prev, [user.id]: null }))
      }, 3000)
    } catch (error) {
      console.error('Failed to send quick reply:', error)
      setReplyStatus(prev => ({ ...prev, [user.id]: 'error' }))

      // Clear error status after 5 seconds
      setTimeout(() => {
        setReplyStatus(prev => ({ ...prev, [user.id]: null }))
      }, 5000)
    } finally {
      setLoading(false)
    }
  }

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date()
    const msgTime = new Date(timestamp)
    const diffMs = now.getTime() - msgTime.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`

    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`

    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  }

  if (missedUsers.length === 0) {
    return null
  }

  return (
    <div className="mb-6 rounded-lg border border-orange-200 bg-orange-50/30">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex justify-between items-center p-4 w-full rounded-t-lg transition-colors hover:bg-orange-50"
      >
        <div className="flex gap-3 items-center">
          <Clock className="w-4 h-4 text-orange-600" />
          <span className="font-medium text-gray-900">Quick Reply</span>
          <Badge variant="secondary" className="px-2 py-1 text-xs text-orange-800 bg-orange-200">
            {missedUsers.length}
          </Badge>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </button>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="p-4 space-y-3 border-t border-orange-200/50">
          {missedUsers.map((user) => (
            <div key={user.id} className="p-3 bg-white rounded-lg border border-orange-200/30">
              <div className="flex justify-between items-center mb-3">
                <div className="flex gap-2 items-center">
                  <User className="w-3 h-3 text-orange-600" />
                  <span className="text-sm font-medium text-gray-900">{user.name}</span>
                  {user.conversationName && (
                    <span className="text-xs text-gray-500">• {user.conversationName}</span>
                  )}
                </div>
                <div className="flex gap-2 items-center text-xs text-gray-500">
                  <span>{formatTimeAgo(user.lastMessageTime)}</span>
                  <Badge variant="outline" className="text-xs">
                    {user.messageCount}
                  </Badge>
                </div>
              </div>

              <div>
                <div className="flex gap-2 justify-start max-w-md">
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1 text-xs text-white bg-orange-600 hover:bg-orange-700"
                    onClick={() => handleQuickReply(user, "Sure, I will get back to you")}
                    disabled={loading}
                  >
                    <Send className="mr-1 w-3 h-3" />
                    I'll get back to you
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs text-orange-700 border-orange-300 hover:bg-orange-50"
                    onClick={() => handleQuickReply(user, "Let me get back to you in 20min")}
                    disabled={loading}
                  >
                    <Clock className="mr-1 w-3 h-3" />
                    Back in 20min
                  </Button>
                </div>
              </div>

              {/* Compact Status feedback */}
              {replyStatus[user.id] === 'success' && (
                <div className="flex gap-1 items-center mt-2 text-xs text-green-600">
                  <CheckCircle className="w-3 h-3" />
                  <span>Sent!</span>
                </div>
              )}
              {replyStatus[user.id] === 'error' && (
                <div className="flex gap-1 items-center mt-2 text-xs text-red-600">
                  <AlertCircle className="w-3 h-3" />
                  <span>Failed - try again</span>
                </div>
              )}
              {loading && (
                <div className="flex gap-1 items-center mt-2 text-xs text-blue-600">
                  <div className="w-3 h-3 rounded-full border border-blue-600 animate-spin border-t-transparent"></div>
                  <span>Sending...</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 