export interface UserSettings {
  autoStart: boolean
  analytics: boolean
  theme: 'light' | 'dark' | 'system'
  startMinimized: boolean
  notifications: {
    teamsStatusChanges: boolean
    systemSleepPrevention: boolean
  }
}

export interface AppSettings {
  userSettings: UserSettings
  onboardingCompleted: boolean
}

export interface TeamsSettings {
  autoStart: boolean
  keepAliveInterval: number
  preventSleep: boolean
}

// Re-export existing types
export * from './electron' 