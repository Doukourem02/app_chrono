/**
 * Utilitaire de debug conditionnel
 * Remplace les console.log pour éviter la latence et les re-renders inutiles
 */
import { logger } from './logger'

export const debug = (...args: unknown[]): void => {
  if (process.env.NODE_ENV === 'development') {
    logger.debug(...args)
  }
}

export const debugWarn = (...args: unknown[]): void => {
  if (process.env.NODE_ENV === 'development') {
    logger.warn(...args)
  }
}

export const debugError = (...args: unknown[]): void => {
  if (process.env.NODE_ENV === 'development') {
    logger.error(...args)
  }
}

