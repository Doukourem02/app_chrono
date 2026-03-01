import { io, Socket } from 'socket.io-client'
import { supabase } from './supabase'
import { logger } from '@/utils/logger'

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000'

// Interface pour les données de commande reçues via Socket.IO
interface SocketOrder {
  id?: string
  status?: string
  is_phone_order?: boolean
  [key: string]: unknown // Permet d'autres propriétés dynamiques
}

interface OrderStatusUpdateData {
  order?: SocketOrder
  [key: string]: unknown
}

interface OrderCreatedData {
  order?: SocketOrder
  [key: string]: unknown
}

class AdminSocketService {
  private socket: Socket | null = null
  private isConnecting = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map()

  /**
   * Se connecter au serveur Socket.IO
   */
  async connect(): Promise<void> {
    if (this.socket?.connected || this.isConnecting) {
      if (process.env.NODE_ENV === 'development') {
        logger.debug('[adminSocketService] Connexion déjà en cours ou établie')
      }
      return
    }

    logger.debug('[adminSocketService] connect() CALLED', { 
      timestamp: new Date().toISOString(), 
      stack: new Error().stack,
      alreadyConnected: this.socket?.connected,
      isConnecting: this.isConnecting
    })

    this.isConnecting = true

    try {
      if (process.env.NODE_ENV === 'development') {
        logger.debug('[adminSocketService] Tentative de connexion à:', SOCKET_URL)
        logger.debug('[adminSocketService] Origin actuel:', typeof window !== 'undefined' ? window.location.origin : 'server-side')
      }

      // Récupérer le token d'authentification
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No access token available')
      }
      
      if (process.env.NODE_ENV === 'development') {
        logger.debug('[adminSocketService] Token d\'authentification récupéré')
      }

      // Créer la connexion Socket.IO
      // Note: Socket.IO n'utilise pas directement l'auth dans les options
      // L'authentification se fait via l'événement 'admin-connect'
      // Note: pingTimeout et pingInterval sont des options serveur, pas client
      // Le client utilise les valeurs configurées par le serveur
      this.socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'], // Essayer websocket en premier, puis polling
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
        reconnectionAttempts: this.maxReconnectAttempts,
        timeout: 20000, // 20 secondes de timeout
        forceNew: false,
        upgrade: true,
        autoConnect: true,
        withCredentials: true,
        // Auth Socket.IO (requis côté backend en production)
        auth: {
          token: session.access_token,
        },
        // Options supplémentaires pour améliorer la stabilité
        rememberUpgrade: true,
      })

      // Gérer la connexion
      this.socket.on('connect', () => {
        this.reconnectAttempts = 0
        this.isConnecting = false
        
        if (process.env.NODE_ENV === 'development') {
          logger.info('[adminSocketService] Connecté au serveur Socket.IO')
        }

        // Envoyer l'événement admin-connect avec l'ID de l'admin
        if (session.user?.id) {
          logger.debug('[adminSocketService] 🔐 Envoi admin-connect avec adminId:', session.user.id)
          this.socket?.emit('admin-connect', session.user.id)
        }
      })

      // Gérer la déconnexion
      this.socket.on('disconnect', (reason) => {
        this.isConnecting = false
        
        // Ne pas logger les déconnexions normales ou les timeouts comme des erreurs
        if (process.env.NODE_ENV === 'development') {
          if (reason === 'io client disconnect') {
            logger.debug('[adminSocketService] Déconnexion volontaire')
          } else if (reason === 'transport close' || reason === 'transport error') {
            logger.warn('[adminSocketService] Déconnexion due à une erreur de transport:', reason)
          } else {
            logger.debug('[adminSocketService] Déconnexion:', reason)
          }
        }

        // Si la déconnexion n'est pas volontaire, laisser Socket.IO gérer la reconnexion automatique
        if (reason === 'io server disconnect') {
          // Le serveur a forcé la déconnexion, ne pas se reconnecter automatiquement
          this.socket?.connect()
        }
      })

      // Gérer les erreurs de connexion
      this.socket.on('connect_error', (error) => {
        this.isConnecting = false
        this.reconnectAttempts++
        
        // Ignorer les erreurs de polling temporaires (Socket.IO essaie plusieurs transports)
        const isTemporaryPollError = error.message.includes('xhr poll error') || 
                                     error.message.includes('poll error') ||
                                     error.message.includes('transport unknown')
        
        // Ne logger que les erreurs importantes ou après plusieurs tentatives
        if (process.env.NODE_ENV === 'development') {
          if (!isTemporaryPollError || this.reconnectAttempts >= 3) {
            logger.error('[adminSocketService] Erreur de connexion:', error.message)
            logger.error('[adminSocketService] URL Socket.IO:', SOCKET_URL)
            logger.error('[adminSocketService] Tentative:', this.reconnectAttempts, '/', this.maxReconnectAttempts)
            
            // Afficher des suggestions selon le type d'erreur
            if (error.message.includes('timeout')) {
              logger.warn('[adminSocketService] Timeout - Vérifiez que le serveur backend est démarré sur', SOCKET_URL)
            } else if (error.message.includes('CORS')) {
              logger.warn('[adminSocketService] Erreur CORS - Vérifiez ALLOWED_ORIGINS dans le backend')
            } else if (error.message.includes('ECONNREFUSED')) {
              logger.warn('[adminSocketService] Connexion refusée - Le serveur n\'est peut-être pas démarré')
            } else if (isTemporaryPollError) {
              logger.warn('[adminSocketService] Erreur de polling HTTP (tentative', this.reconnectAttempts, ')')
              logger.warn('   Socket.IO essaie différents transports, cela peut être normal...')
            }
          }
        }

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          logger.warn('[adminSocketService] Nombre maximum de tentatives de reconnexion atteint')
          logger.warn('[adminSocketService] Le suivi en temps réel est désactivé')
          logger.warn('[adminSocketService] L\'application continuera avec le polling HTTP')
          logger.warn('[adminSocketService] Pour activer le temps réel, vérifiez que:')
          logger.warn('   1. Le serveur backend est démarré (cd chrono_backend && npm run dev)')
          logger.warn('   2. NEXT_PUBLIC_SOCKET_URL est correct dans .env.local:', SOCKET_URL)
          logger.warn('   3. Le port 4000 n\'est pas bloqué par un firewall')
          
          // Émettre un événement pour informer les composants
          this.emit('admin:connection-failed', {
            message: 'Impossible de se connecter au serveur Socket.IO',
            url: SOCKET_URL
          })
        }
      })

      // Écouter la confirmation de connexion admin
      this.socket.on('admin:connected', (data) => {
        if (process.env.NODE_ENV === 'development') {
          logger.info('[adminSocketService] Admin connecté confirmé par le serveur:', data)
        }
        this.emit('admin:connected', data)
      })

      // Écouter les drivers initiaux
      this.socket.on('admin:initial-drivers', (data) => {
        if (process.env.NODE_ENV === 'development') {
          logger.debug('[adminSocketService] Drivers initiaux reçus:', data.drivers?.length || 0)
        }
        this.emit('admin:initial-drivers', data)
      })

      // Écouter les événements de drivers
      this.socket.on('driver:online', (data) => {
        if (process.env.NODE_ENV === 'development') {
          logger.debug('[adminSocketService] Driver en ligne:', data.userId)
        }
        this.emit('driver:online', data)
      })

      this.socket.on('driver:offline', (data) => {
        if (process.env.NODE_ENV === 'development') {
          logger.debug('[adminSocketService] Driver hors ligne:', data.userId)
        }
        this.emit('driver:offline', data)
      })

      this.socket.on('driver:position:update', (data) => {
        // Ne pas logger toutes les mises à jour de position (trop fréquent)
        this.emit('driver:position:update', data)
      })

      // Écouter les mises à jour de commandes
      // Le son est géré uniquement dans useNotifications pour rester aligné avec les notifications
      this.socket.on('order:status:update', (data: OrderStatusUpdateData) => {
        if (process.env.NODE_ENV === 'development') {
          logger.debug('[adminSocketService] Mise à jour de commande:', data.order?.id)
        }
        this.emit('order:status:update', data)
      })

      // Écouter les nouvelles commandes créées
      // Le son est géré uniquement dans useNotifications pour rester aligné avec les notifications
      this.socket.on('order:created', (data: OrderCreatedData) => {
        if (process.env.NODE_ENV === 'development') {
          logger.debug('[adminSocketService] order:created:', data.order?.id)
        }
        this.emit('order:created', data)
      })

      // Écouter les erreurs
      this.socket.on('admin:error', (data) => {
        logger.error('[adminSocketService] Erreur serveur:', data)
        this.emit('admin:error', data)
      })

    } catch (error: unknown) {
      this.isConnecting = false
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('[adminSocketService] Erreur lors de la connexion:', errorMessage)
      throw error
    }
  }

  /**
   * Se déconnecter du serveur
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.isConnecting = false
      this.reconnectAttempts = 0
      this.listeners.clear()
      
      if (process.env.NODE_ENV === 'development') {
        logger.debug('[adminSocketService] Déconnecté du serveur')
      }
    }
  }

  /**
   * Vérifier si la connexion est active
   */
  isConnected(): boolean {
    return this.socket?.connected || false
  }

  /**
   * Écouter un événement
   */
  on(event: string, callback: (data: unknown) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)?.add(callback)

    // Retourner une fonction pour se désabonner
    return () => {
      this.listeners.get(event)?.delete(callback)
    }
  }

  /**
   * Émettre un événement local (pour les listeners)
   */
  private emit(event: string, data: unknown): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(data)
        } catch (error) {
          logger.error(`[adminSocketService] Erreur dans le callback pour ${event}:`, error)
        }
      })
    }
  }

  /**
   * Émettre un événement au serveur
   */
  emitToServer(event: string, data: unknown): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data)
    } else {
      logger.warn(`[adminSocketService] Tentative d'émettre ${event} mais non connecté`)
    }
  }
}

// Instance singleton
export const adminSocketService = new AdminSocketService()
export default adminSocketService

