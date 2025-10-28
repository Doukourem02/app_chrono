import { Alert } from 'react-native';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  component?: string;
  extra?: any;
}

class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private currentLevel = __DEV__ ? LogLevel.DEBUG : LogLevel.INFO;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatMessage(level: LogLevel, message: string, component?: string): string {
    const timestamp = new Date().toISOString();
    const levelStr = LogLevel[level];
    const componentStr = component ? `[${component}]` : '';
    return `${timestamp} ${levelStr} ${componentStr} ${message}`;
  }

  private addLog(level: LogLevel, message: string, component?: string, extra?: any) {
    const logEntry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      component,
      extra,
    };

    this.logs.push(logEntry);
    
    // Limiter le nombre de logs en mémoire
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Afficher dans la console en mode développement
    if (__DEV__) {
      const formattedMessage = this.formatMessage(level, message, component);
      switch (level) {
        case LogLevel.DEBUG:
          console.log(formattedMessage, extra);
          break;
        case LogLevel.INFO:
          console.info(formattedMessage, extra);
          break;
        case LogLevel.WARN:
          console.warn(formattedMessage, extra);
          break;
        case LogLevel.ERROR:
          console.error(formattedMessage, extra);
          break;
      }
    }
  }

  debug(message: string, component?: string, extra?: any) {
    if (this.currentLevel <= LogLevel.DEBUG) {
      this.addLog(LogLevel.DEBUG, message, component, extra);
    }
  }

  info(message: string, component?: string, extra?: any) {
    if (this.currentLevel <= LogLevel.INFO) {
      this.addLog(LogLevel.INFO, message, component, extra);
    }
  }

  warn(message: string, component?: string, extra?: any) {
    if (this.currentLevel <= LogLevel.WARN) {
      this.addLog(LogLevel.WARN, message, component, extra);
    }
  }

  error(message: string, component?: string, extra?: any) {
    if (this.currentLevel <= LogLevel.ERROR) {
      this.addLog(LogLevel.ERROR, message, component, extra);
    }
  }

  // Méthode pour afficher une erreur à l'utilisateur
  userError(message: string, title = 'Erreur') {
    this.error(message, 'UserError');
    Alert.alert(title, message);
  }

  // Récupérer les logs pour debugging ou envoi au serveur
  getLogs(level?: LogLevel): LogEntry[] {
    if (level !== undefined) {
      return this.logs.filter(log => log.level >= level);
    }
    return [...this.logs];
  }

  // Nettoyer les logs
  clearLogs() {
    this.logs = [];
  }

  // Changer le niveau de log
  setLevel(level: LogLevel) {
    this.currentLevel = level;
  }
}

export const logger = Logger.getInstance();