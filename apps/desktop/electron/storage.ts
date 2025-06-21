import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import { NotificationMessage, NotificationSession, UserSettings } from './types'
import type { BrowserInfo } from './utils/browser-detector'

interface DatabaseRow {
  [key: string]: any
}

class AppStorage {
  private db: Database.Database | null = null
  private isInitialized = false
  private dbPath: string

  constructor() {
    // Store database in app's userData directory
    this.dbPath = path.join(app.getPath('userData'), 'app-storage.db')
  }

  async init(): Promise<void> {
    if (this.isInitialized) return
    
    try {
      this.db = new Database(this.dbPath)
      
      // Enable WAL mode for better performance
      this.db.pragma('journal_mode = WAL')
      
      // Create tables
      this.createTables()
      
      this.isInitialized = true
      console.log('Storage initialized successfully with better-sqlite3')
    } catch (error) {
      console.error('Failed to initialize storage:', error)
      throw error
    }
  }

  private createTables(): void {
    if (!this.db) throw new Error('Database not initialized')

    // Key-value storage table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS storage (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Notification sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notification_sessions (
        id TEXT PRIMARY KEY,
        start_time TEXT NOT NULL,
        end_time TEXT,
        is_active BOOLEAN DEFAULT 1,
        message_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Notification messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notification_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        from_user TEXT NOT NULL,
        content TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        conversation_name TEXT NOT NULL,
        message_type TEXT NOT NULL,
        is_read BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES notification_sessions(id)
      )
    `)

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_storage_updated_at ON storage(updated_at);
      CREATE INDEX IF NOT EXISTS idx_notification_sessions_active ON notification_sessions(is_active);
      CREATE INDEX IF NOT EXISTS idx_notification_messages_session ON notification_messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_notification_messages_read ON notification_messages(is_read);
    `)
  }

  async get<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    if (!this.db) throw new Error('Database not initialized')
    
    const stmt = this.db.prepare('SELECT value FROM storage WHERE key = ?')
    const row = stmt.get(key) as { value: string } | undefined
    
    if (row) {
      try {
        return JSON.parse(row.value)
      } catch (error) {
        console.error('Failed to parse stored value:', error)
        return defaultValue
      }
    }
    
    return defaultValue
  }

  async set(key: string, value: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')
    
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO storage (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `)
    
    stmt.run(key, JSON.stringify(value))
  }

  async delete(key: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')
    
    const stmt = this.db.prepare('DELETE FROM storage WHERE key = ?')
    stmt.run(key)
  }

  async has(key: string): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized')
    
    const stmt = this.db.prepare('SELECT 1 FROM storage WHERE key = ?')
    return stmt.get(key) !== undefined
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close()
      this.db = null
      this.isInitialized = false
    }
  }

  // Convenience methods for common app settings
  async getOnboardingCompleted(): Promise<boolean> {
    const result = await this.get('onboarding_completed', false)
    return result ?? false
  }

  async setOnboardingCompleted(completed: boolean): Promise<void> {
    await this.set('onboarding_completed', completed)
  }

  async getAppSettings(): Promise<any> {
    return await this.get('app_settings', {})
  }

  async setAppSettings(settings: any): Promise<void> {
    await this.set('app_settings', settings)
  }

  async getTeamsSettings(): Promise<any> {
    return await this.get('teams_settings', {
      autoStart: false,
      keepAliveInterval: 120000, // 2 minutes
      preventSleep: true
    })
  }

  async setTeamsSettings(settings: any): Promise<void> {
    await this.set('teams_settings', settings)
  }

  // User settings methods
  async getUserSettings(): Promise<UserSettings> {
    const defaultSettings: UserSettings = {
      autoStart: false,
      analytics: false,
      theme: 'system',
      startMinimized: false,
      notifications: {
        teamsStatusChanges: true,
        systemSleepPrevention: true
      }
    }
    
    const settings = await this.get('user_settings', defaultSettings)
    return settings || defaultSettings
  }

  async setUserSettings(settings: Partial<UserSettings>): Promise<void> {
    const currentSettings = await this.getUserSettings()
    const updatedSettings = { ...currentSettings, ...settings }
    await this.set('user_settings', updatedSettings)
  }

  async updateUserSetting<K extends keyof UserSettings>(
    key: K, 
    value: UserSettings[K]
  ): Promise<void> {
    const currentSettings = await this.getUserSettings()
    currentSettings[key] = value
    await this.set('user_settings', currentSettings)
  }

  // Notification session methods
  async createNotificationSession(): Promise<string> {
    if (!this.db) throw new Error('Database not initialized')
    
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const session: NotificationSession = {
      id: sessionId,
      startTime: new Date().toISOString(),
      isActive: true,
      messageCount: 0
    }
    
    const stmt = this.db.prepare(`
      INSERT INTO notification_sessions (id, start_time, is_active, message_count)
      VALUES (?, ?, ?, ?)
    `)
    
    stmt.run(sessionId, session.startTime, 1, 0)
    await this.set('active_notification_session', sessionId)
    
    return sessionId
  }

  async getActiveNotificationSession(): Promise<string | null> {
    const result = await this.get('active_notification_session', null)
    return result ?? null
  }

  async getNotificationSessions(limit: number = 10): Promise<NotificationSession[]> {
    if (!this.db) throw new Error('Database not initialized')
    
    const stmt = this.db.prepare(`
      SELECT id, start_time, end_time, is_active, message_count
      FROM notification_sessions
      ORDER BY created_at DESC
      LIMIT ?
    `)
    
    const rows = stmt.all(limit) as any[]
    
    return rows.map(row => ({
      id: row.id,
      startTime: row.start_time,
      endTime: row.end_time,
      isActive: Boolean(row.is_active),
      messageCount: row.message_count
    }))
  }

  async addNotificationMessage(sessionId: string, message: NotificationMessage): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')
    
    const transaction = this.db.transaction(() => {
      // Insert the message
      const insertStmt = this.db!.prepare(`
        INSERT INTO notification_messages (
          id, session_id, timestamp, from_user, content, conversation_id, 
          conversation_name, message_type, is_read
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      
      insertStmt.run(
        message.id,
        sessionId,
        message.timestamp,
        message.from,
        message.content,
        message.conversationId,
        message.conversationName,
        message.messageType,
        message.isRead ? 1 : 0
      )
      
      // Update session message count
      const updateStmt = this.db!.prepare(`
        UPDATE notification_sessions
        SET message_count = message_count + 1
        WHERE id = ?
      `)
      
      updateStmt.run(sessionId)
    })
    
    transaction()
  }

  async getNotificationMessages(sessionId: string): Promise<NotificationMessage[]> {
    if (!this.db) throw new Error('Database not initialized')
    
    const stmt = this.db.prepare(`
      SELECT id, timestamp, from_user, content, conversation_id, 
             conversation_name, message_type, is_read
      FROM notification_messages
      WHERE session_id = ?
      ORDER BY created_at DESC
    `)
    
    const rows = stmt.all(sessionId) as any[]
    
    return rows.map(row => ({
      id: row.id,
      sessionId: sessionId,
      timestamp: row.timestamp,
      from: row.from_user,
      content: row.content,
      conversationId: row.conversation_id,
      conversationName: row.conversation_name,
      messageType: row.message_type,
      isRead: Boolean(row.is_read)
    }))
  }

  async markNotificationAsRead(messageId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')
    
    const stmt = this.db.prepare(`
      UPDATE notification_messages
      SET is_read = 1
      WHERE id = ?
    `)
    
    stmt.run(messageId)
  }

  async getUnreadNotificationCount(sessionId?: string): Promise<number> {
    if (!this.db) throw new Error('Database not initialized')
    
    let stmt: any
    let params: any[] = []
    
    if (sessionId) {
      stmt = this.db.prepare(`
        SELECT COUNT(*) as count
        FROM notification_messages
        WHERE session_id = ? AND is_read = 0
      `)
      params = [sessionId]
    } else {
      stmt = this.db.prepare(`
        SELECT COUNT(*) as count
        FROM notification_messages
        WHERE is_read = 0
      `)
    }
    
    const result = stmt.get(...params) as { count: number }
    return result.count
  }

  async endNotificationSession(sessionId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')
    
    const stmt = this.db.prepare(`
      UPDATE notification_sessions
      SET is_active = 0, end_time = ?
      WHERE id = ?
    `)
    
    stmt.run(new Date().toISOString(), sessionId)
    
    // Clear active session if this was the active one
    const activeSession = await this.getActiveNotificationSession()
    if (activeSession === sessionId) {
      await this.delete('active_notification_session')
    }
  }

  // Browser settings methods
  async getBrowserSettings(): Promise<{ selectedBrowserId: string | null; availableBrowsers: BrowserInfo[] }> {
    const defaultSettings = {
      selectedBrowserId: null,
      availableBrowsers: []
    }
    
    const settings = await this.get('browser_settings', defaultSettings)
    return settings || defaultSettings
  }

  async setBrowserSettings(settings: { selectedBrowserId: string | null; availableBrowsers: BrowserInfo[] }): Promise<void> {
    await this.set('browser_settings', settings)
  }

  async setSelectedBrowser(browserId: string): Promise<void> {
    const currentSettings = await this.getBrowserSettings()
    currentSettings.selectedBrowserId = browserId
    await this.setBrowserSettings(currentSettings)
  }

  async getSelectedBrowser(): Promise<string | null> {
    const settings = await this.getBrowserSettings()
    return settings.selectedBrowserId
  }

  async updateAvailableBrowsers(browsers: BrowserInfo[]): Promise<void> {
    const currentSettings = await this.getBrowserSettings()
    currentSettings.availableBrowsers = browsers
    await this.setBrowserSettings(currentSettings)
  }

  async getAvailableBrowsers(): Promise<BrowserInfo[]> {
    const settings = await this.getBrowserSettings()
    return settings.availableBrowsers || []
  }

  // AI model settings methods
  async getAISettings(): Promise<{ currentModel: string | null }> {
    const defaultSettings = {
      currentModel: null
    }
    
    const settings = await this.get('ai_settings', defaultSettings)
    return settings || defaultSettings
  }

  async setAISettings(settings: { currentModel: string | null }): Promise<void> {
    await this.set('ai_settings', settings)
  }

  async setCurrentAIModel(modelId: string | null): Promise<void> {
    const currentSettings = await this.getAISettings()
    currentSettings.currentModel = modelId
    await this.setAISettings(currentSettings)
  }

  async getCurrentAIModel(): Promise<string | null> {
    const settings = await this.getAISettings()
    return settings.currentModel
  }
}

// Export singleton instance
export const storage = new AppStorage() 