import { useState, useEffect, useRef, useCallback } from 'react'
import { adminSocketService } from '@/lib/adminSocketService'
import { debug, debugError } from '@/utils/debug'

/**
 * Hook pour gérer la connexion Socket.IO
 * Retourne l'état de connexion et une fonction pour se connecter
 */
export function useSocketConnection() {
  const [isConnected, setIsConnected] = useState(false)
  const isConnectedRef = useRef(false)
  const hasAttemptedConnection = useRef(false)

  const connect = useCallback(async () => {
    if (hasAttemptedConnection.current) {
      debug('[useSocketConnection] Connexion déjà tentée')
      return
    }

    hasAttemptedConnection.current = true

    try {
      await adminSocketService.connect()
    } catch (err) {
      debugError('[useSocketConnection] Erreur de connexion:', err)
      hasAttemptedConnection.current = false
    }
  }, [])

  useEffect(() => {
    // Se connecter au montage
    connect()

    // Vérifier l'état de connexion initial
    const checkConnection = () => {
      const nowConnected = adminSocketService.isConnected()
      if (isConnectedRef.current !== nowConnected) {
        isConnectedRef.current = nowConnected
        setIsConnected(nowConnected)
      }
    }

    checkConnection()

    // Écouter les événements de connexion
    const unsubscribeConnected = adminSocketService.on('admin:connected', () => {
      isConnectedRef.current = true
      setIsConnected(true)
    })

    const unsubscribeDisconnect = adminSocketService.on('disconnect', () => {
      isConnectedRef.current = false
      setIsConnected(false)
    })

    const unsubscribeConnectionFailed = adminSocketService.on('admin:connection-failed', () => {
      isConnectedRef.current = false
      setIsConnected(false)
      hasAttemptedConnection.current = false
    })

    return () => {
      unsubscribeConnected()
      unsubscribeDisconnect()
      unsubscribeConnectionFailed()
    }
  }, [connect])

  return { isConnected, connect }
}

