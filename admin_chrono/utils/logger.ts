/**
 * Logger utilitaire pour remplacer console.log
 * En production, les logs de debug sont désactivés
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

const isDevelopment = process.env.NODE_ENV === 'development';
const isClient = typeof window !== 'undefined';

class LoggerService implements Logger {
  private shouldLog(level: LogLevel): boolean {
    // En production, ne logger que les erreurs et warnings
    if (!isDevelopment) {
      return level === 'error' || level === 'warn';
    }
    return true;
  }

  private formatMessage(prefix: string, ...args: unknown[]): unknown[] {
    const timestamp = new Date().toISOString();
    return [`[${timestamp}] ${prefix}`, ...args];
  }

  debug(...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      if (isClient) {
        console.debug(...this.formatMessage('DEBUG', ...args));
      } else {
        console.debug(...this.formatMessage('DEBUG', ...args));
      }
    }
  }

  info(...args: unknown[]): void {
    if (this.shouldLog('info')) {
      if (isClient) {
        console.info(...this.formatMessage('INFO', ...args));
      } else {
        console.info(...this.formatMessage('INFO', ...args));
      }
    }
  }

  warn(...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      if (isClient) {
        console.warn(...this.formatMessage('WARN', ...args));
      } else {
        console.warn(...this.formatMessage('WARN', ...args));
      }
    }
  }

  error(...args: unknown[]): void {
    if (this.shouldLog('error')) {
      if (isClient) {
        console.error(...this.formatMessage('ERROR', ...args));
      } else {
        console.error(...this.formatMessage('ERROR', ...args));
      }
    }
  }
}

// Export singleton instance
export const logger = new LoggerService();

// Export pour compatibilité avec le code existant
export default logger;

