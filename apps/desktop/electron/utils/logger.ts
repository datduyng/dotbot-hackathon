import { app } from 'electron'
import fs from 'fs'
import path from 'path'

class Logger {
  private logDir: string
  private logFile: string
  private errorFile: string
  private isDev: boolean

  constructor() {
    this.isDev = !app.isPackaged
    this.logDir = path.join(app.getPath('userData'), 'logs')
    this.logFile = path.join(this.logDir, 'app.log')
    this.errorFile = path.join(this.logDir, 'error.log')
    
    // Create logs directory if it doesn't exist
    if (!this.isDev) {
      try {
        if (!fs.existsSync(this.logDir)) {
          fs.mkdirSync(this.logDir, { recursive: true })
        }
      } catch (error) {
        console.error('Failed to create log directory:', error)
      }
    }
  }

  private formatMessage(level: string, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString()
    const argsStr = args.length > 0 ? ' ' + args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ') : ''
    return `[${timestamp}] ${level}: ${message}${argsStr}`
  }

  private writeToFile(filename: string, content: string): void {
    if (this.isDev) return
    
    try {
      fs.appendFileSync(filename, content + '\n')
    } catch (error) {
      console.error('Failed to write to log file:', error)
    }
  }

  info(message: string, ...args: any[]): void {
    const formatted = this.formatMessage('INFO', message, ...args)
    console.log(formatted)
    this.writeToFile(this.logFile, formatted)
  }

  warn(message: string, ...args: any[]): void {
    const formatted = this.formatMessage('WARN', message, ...args)
    console.warn(formatted)
    this.writeToFile(this.logFile, formatted)
  }

  error(message: string, ...args: any[]): void {
    const formatted = this.formatMessage('ERROR', message, ...args)
    console.error(formatted)
    this.writeToFile(this.logFile, formatted)
    this.writeToFile(this.errorFile, formatted)
  }

  debug(message: string, ...args: any[]): void {
    const formatted = this.formatMessage('DEBUG', message, ...args)
    if (this.isDev) {
      console.debug(formatted)
    }
    this.writeToFile(this.logFile, formatted)
  }

  getLogPath(): string {
    return this.logFile
  }

  getErrorLogPath(): string {
    return this.errorFile
  }

  // Clear old logs (keep last 7 days)
  cleanOldLogs(): void {
    if (this.isDev) return
    
    try {
      const logFiles = fs.readdirSync(this.logDir)
      const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
      
      logFiles.forEach(file => {
        const filePath = path.join(this.logDir, file)
        const stat = fs.statSync(filePath)
        if (stat.mtime.getTime() < weekAgo) {
          fs.unlinkSync(filePath)
        }
      })
    } catch (error) {
      this.error('Failed to clean old logs:', error)
    }
  }
}

export const logger = new Logger() 