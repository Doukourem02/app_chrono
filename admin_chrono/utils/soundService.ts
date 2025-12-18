/**
 * Service de gestion des sons pour le dashboard admin
 * Les fichiers audio doivent être placés dans /public/sounds/
 */

class SoundService {
  private sounds: Map<string, HTMLAudioElement> = new Map()
  private soundEnabled: boolean = true
  private volume: number = 0.7 // Volume par défaut (0.0 à 1.0)
  private userInteracted: boolean = false // Pour savoir si l'utilisateur a interagi avec la page

  /**
   * Initialise le service et charge la préférence utilisateur
   */
  async initialize(): Promise<void> {
    // Charger la préférence depuis localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('admin_sound_enabled')
      this.soundEnabled = saved !== 'false' // Par défaut activé
      
      const savedVolume = localStorage.getItem('admin_sound_volume')
      if (savedVolume) {
        this.volume = parseFloat(savedVolume)
      }
      
      // Précharger les sons après une première interaction utilisateur
      // Cela permet de contourner les restrictions de lecture automatique
      const preloadSounds = async () => {
        if (this.soundEnabled) {
          try {
            // Précharger tous les sons
            const newOrder = this.loadSound('newOrder', '/sounds/new-order.wav')
            const newMessage = this.loadSound('newMessage', '/sounds/new-message.wav')
            const success = this.loadSound('success', '/sounds/success.wav')
            
            // Essayer de jouer et arrêter immédiatement pour "débloquer" l'autoplay
            // Cela permet au navigateur de savoir que l'utilisateur a interagi
            try {
              await newOrder.play()
              newOrder.pause()
              newOrder.currentTime = 0
            } catch {}
            
            try {
              await newMessage.play()
              newMessage.pause()
              newMessage.currentTime = 0
            } catch {}
            
            try {
              await success.play()
              success.pause()
              success.currentTime = 0
            } catch {}
            
            this.userInteracted = true
            console.log('🔊 [SoundService] Sons préchargés et débloqués après interaction')
          } catch (error) {
            console.warn('🔊 [SoundService] Erreur préchargement:', error)
          }
        }
      }
      
      // Précharger au premier clic/interaction
      const events = ['click', 'touchstart', 'keydown', 'mousedown']
      const preloadOnce = () => {
        if (!this.userInteracted) {
          preloadSounds()
          events.forEach(event => {
            window.removeEventListener(event, preloadOnce)
          })
        }
      }
      
      events.forEach(event => {
        window.addEventListener(event, preloadOnce, { once: true, passive: true })
      })
    }
  }

  /**
   * Active ou désactive les sons
   */
  setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled
    if (typeof window !== 'undefined') {
      localStorage.setItem('admin_sound_enabled', String(enabled))
    }
  }

  /**
   * Vérifie si les sons sont activés
   */
  isSoundEnabled(): boolean {
    return this.soundEnabled
  }

  /**
   * Définit le volume (0.0 à 1.0)
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume))
    if (typeof window !== 'undefined') {
      localStorage.setItem('admin_sound_volume', String(this.volume))
    }
  }

  /**
   * Obtient le volume actuel
   */
  getVolume(): number {
    return this.volume
  }

  /**
   * Charge un fichier audio
   */
  private loadSound(name: string, path: string): HTMLAudioElement {
    if (this.sounds.has(name)) {
      return this.sounds.get(name)!
    }

    const audio = new Audio(path)
    audio.volume = this.volume
    audio.preload = 'auto'
    this.sounds.set(name, audio)
    return audio
  }

  /**
   * Joue un son
   */
  private async playSound(name: string, path: string): Promise<void> {
    if (!this.soundEnabled || typeof window === 'undefined') {
      if (process.env.NODE_ENV === 'development') {
        console.debug(`🔊 [SoundService] Son ${name} ignoré:`, { soundEnabled: this.soundEnabled, hasWindow: typeof window !== 'undefined' })
      }
      return
    }

    try {
      const audio = this.loadSound(name, path)
      audio.volume = this.volume
      // Réinitialiser la position pour rejouer depuis le début
      audio.currentTime = 0
      
      // Tenter de jouer le son
      const playPromise = audio.play()
      
      if (playPromise !== undefined) {
        await playPromise
        if (process.env.NODE_ENV === 'development') {
          console.log(`🔊 [SoundService] ✅ Son ${name} joué avec succès`)
        }
        // Marquer que l'utilisateur a interagi (via le son qui joue)
        this.userInteracted = true
      }
    } catch (error: any) {
      // Les navigateurs bloquent souvent la lecture automatique
      // Si c'est une erreur de permission, essayer de précharger pour la prochaine fois
      if (error?.name === 'NotAllowedError' || error?.code === 0) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`🔊 [SoundService] ⚠️ Lecture automatique bloquée pour ${name}. L'utilisateur doit interagir avec la page d'abord.`)
        }
        
        // Si l'utilisateur n'a pas encore interagi, essayer de précharger maintenant
        if (!this.userInteracted) {
          // Déclencher le préchargement en simulant une interaction
          // (mais seulement si on est dans le contexte d'une vraie interaction)
          const events = ['click', 'touchstart', 'keydown']
          const tryPreload = () => {
            if (!this.userInteracted) {
              const audio = this.loadSound(name, path)
              audio.play().then(() => {
                audio.pause()
                audio.currentTime = 0
                this.userInteracted = true
              }).catch(() => {})
            }
            events.forEach(event => {
              window.removeEventListener(event, tryPreload)
            })
          }
          
          // Écouter la prochaine interaction pour débloquer
          events.forEach(event => {
            window.addEventListener(event, tryPreload, { once: true, passive: true })
          })
        }
      } else {
        // Autre type d'erreur
        if (process.env.NODE_ENV === 'development') {
          console.warn(`🔊 [SoundService] ❌ Erreur lecture ${name}:`, error?.message || error)
        }
      }
    }
  }

  /**
   * Son pour nouvelle commande créée (uniquement par les clients)
   */
  async playNewOrder(): Promise<void> {
    await this.playSound('newOrder', '/sounds/new-order.wav')
  }

  /**
   * Son pour nouveau message reçu
   */
  async playNewMessage(): Promise<void> {
    await this.playSound('newMessage', '/sounds/new-message.wav')
  }

  /**
   * Son pour confirmation d'action réussie
   */
  async playSuccess(): Promise<void> {
    await this.playSound('success', '/sounds/success.wav')
  }

  /**
   * Nettoie les ressources
   */
  cleanup(): void {
    this.sounds.forEach((audio) => {
      audio.pause()
      audio.src = ''
    })
    this.sounds.clear()
  }
}

// Instance singleton
export const soundService = new SoundService()

// Initialiser au chargement du module (côté client uniquement)
if (typeof window !== 'undefined') {
  soundService.initialize()
}

