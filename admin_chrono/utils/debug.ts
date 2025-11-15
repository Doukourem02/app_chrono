/**
 * Utilitaire de debug conditionnel
 * Remplace les console.log pour éviter la latence et les re-renders inutiles
 */
export const debug = (...args: unknown[]): void => {
  if (process.env.NODE_ENV === 'development') {
    console.log(...args)
  }
}

export const debugWarn = (...args: unknown[]): void => {
  if (process.env.NODE_ENV === 'development') {
    console.warn(...args)
  }
}

export const debugError = (...args: unknown[]): void => {
  if (process.env.NODE_ENV === 'development') {
    console.error(...args)
  }
}

