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
      
      // Précharger les sons dès le chargement de la page
      // On essaie de débloquer l'autoplay en créant un bouton invisible qui se déclenche automatiquement
      this.attemptAutoPreload()
      
      // Aussi précharger au premier clic/interaction (au cas où l'auto-preload échoue)
      const events = ['click', 'touchstart', 'keydown', 'mousedown']
      const preloadOnce = () => {
        if (!this.userInteracted) {
          this.forcePreload()
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
   * Tente de précharger automatiquement les sons dès le chargement
   * Utilise une technique avec un bouton invisible pour contourner les restrictions
   */
  private attemptAutoPreload(): void {
    if (this.userInteracted || typeof window === 'undefined' || !this.soundEnabled) {
      return
    }

    // Attendre que le DOM soit prêt
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.tryAutoPreloadWithButton()
      })
    } else {
      // DOM déjà chargé
      this.tryAutoPreloadWithButton()
    }
  }

  /**
   * Tente de précharger en créant un bouton invisible qui se déclenche automatiquement
   */
  private tryAutoPreloadWithButton(): void {
    if (this.userInteracted || typeof window === 'undefined') {
      return
    }

    try {
      // Créer un bouton invisible
      const button = document.createElement('button')
      button.style.position = 'fixed'
      button.style.top = '-9999px'
      button.style.left = '-9999px'
      button.style.width = '1px'
      button.style.height = '1px'
      button.style.opacity = '0'
      button.style.pointerEvents = 'none'
      button.setAttribute('aria-hidden', 'true')
      button.setAttribute('tabindex', '-1')
      
      // Ajouter le bouton au DOM
      document.body.appendChild(button)
      
      // Simuler un clic programmatique (ne fonctionne pas toujours à cause des restrictions)
      // Mais on peut essayer de précharger directement
      button.addEventListener('click', async () => {
        await this.forcePreload()
        document.body.removeChild(button)
      }, { once: true })
      
      // Essayer de déclencher le clic (peut ne pas fonctionner à cause des restrictions)
      try {
        button.click()
      } catch {
        // Si le clic programmatique ne fonctionne pas, essayer de précharger directement
        // avec un volume très faible
        this.forcePreloadSilent().catch(() => {
          // Si ça échoue, on attendra une vraie interaction
        })
      }
      
      // Nettoyer après un délai
      setTimeout(() => {
        if (document.body.contains(button)) {
          document.body.removeChild(button)
        }
      }, 1000)
    } catch {
      // Si la création du bouton échoue, essayer le préchargement silencieux
      this.forcePreloadSilent().catch(() => {
        // Ignorer les erreurs
      })
    }
  }

  /**
   * Précharge les sons avec un volume très faible (presque inaudible)
   * pour débloquer l'autoplay sans déranger l'utilisateur
   */
  private async forcePreloadSilent(): Promise<void> {
    if (this.userInteracted || typeof window === 'undefined') {
      return
    }

    try {
      const sounds = [
        { name: 'newOrder', path: '/sounds/new-order.wav' },
        { name: 'newMessage', path: '/sounds/new-message.wav' },
        { name: 'success', path: '/sounds/success.wav' },
      ]

      let preloadSuccess = false
      for (const sound of sounds) {
        try {
          const audio = new Audio(sound.path)
          audio.volume = 0.001 // Volume extrêmement faible (presque inaudible)
          audio.preload = 'auto'
          
          // Essayer de jouer et pauser immédiatement
          const playPromise = audio.play()
          if (playPromise !== undefined) {
            await playPromise
            audio.pause()
            audio.currentTime = 0
            audio.volume = this.volume // Remettre le volume normal
            
            // Stocker dans le cache
            this.sounds.set(sound.name, audio)
            preloadSuccess = true
          }
        } catch {
          // Ignorer les erreurs silencieusement
        }
      }

      if (preloadSuccess) {
        this.userInteracted = true
        if (process.env.NODE_ENV === 'development') {
          console.log('[SoundService] Préchargement silencieux réussi, userInteracted = true')
        }
      }
    } catch {
      // Ignorer les erreurs silencieusement
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
        console.debug(`[SoundService] Son ${name} ignoré:`, { soundEnabled: this.soundEnabled, hasWindow: typeof window !== 'undefined' })
      }
      return
    }

    const audio = this.loadSound(name, path)
    audio.volume = this.volume
    audio.currentTime = 0

    try {
      // Tenter de jouer le son
      const playPromise = audio.play()
      
      if (playPromise !== undefined) {
        await playPromise
        if (process.env.NODE_ENV === 'development') {
          console.log(`[SoundService] Son ${name} joué avec succès`)
        }
        // Marquer que l'utilisateur a interagi (via le son qui joue)
        this.userInteracted = true
        return
      }
    } catch (error: unknown) {
      // Les navigateurs bloquent souvent la lecture automatique
      const err = error as { name?: string; code?: number; message?: string };
      if (err?.name === 'NotAllowedError' || err?.code === 0) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[SoundService] Lecture automatique bloquée pour ${name}. userInteracted: ${this.userInteracted}`)
        }
        
        // Si l'utilisateur n'a pas encore interagi, on ne peut rien faire
        // Le son sera joué après la prochaine interaction (déjà géré dans initialize)
        if (!this.userInteracted) {
          if (process.env.NODE_ENV === 'development') {
            console.warn(`[SoundService] En attente d'interaction utilisateur pour débloquer l'autoplay`)
          }
          return
        }
        
        // Si userInteracted est true mais que ça ne joue toujours pas,
        // essayer de recharger l'audio et réessayer
        try {
          // Créer un nouvel élément audio
          const newAudio = new Audio(path)
          newAudio.volume = this.volume
          newAudio.currentTime = 0
          
          await newAudio.play()
          if (process.env.NODE_ENV === 'development') {
            console.log(`[SoundService] Son ${name} joué avec nouvel élément audio`)
          }
          
          // Mettre à jour le cache
          this.sounds.set(name, newAudio)
        } catch (retryError) {
          if (process.env.NODE_ENV === 'development') {
            console.warn(`[SoundService] Échec relecture avec nouvel audio:`, retryError)
          }
        }
      } else {
        // Autre type d'erreur
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[SoundService] Erreur lecture ${name}:`, err?.message || error)
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
   * Force le préchargement des sons (à appeler après une interaction utilisateur)
   * Cette méthode peut être appelée manuellement pour s'assurer que les sons sont prêts
   */
  async forcePreload(): Promise<void> {
    if (this.userInteracted || typeof window === 'undefined') {
      return
    }

    try {
      const sounds = [
        { name: 'newOrder', path: '/sounds/new-order.wav' },
        { name: 'newMessage', path: '/sounds/new-message.wav' },
        { name: 'success', path: '/sounds/success.wav' },
      ]

      let preloadSuccess = false
      for (const sound of sounds) {
        try {
          const audio = this.loadSound(sound.name, sound.path)
          audio.volume = 0.01 // Volume très faible pour ne pas déranger
          await audio.play()
          audio.pause()
          audio.currentTime = 0
          audio.volume = this.volume // Remettre le volume normal
          preloadSuccess = true
        } catch {
          // Ignorer les erreurs silencieusement pour ce son
        }
      }

      if (preloadSuccess) {
        this.userInteracted = true
        if (process.env.NODE_ENV === 'development') {
          console.log('[SoundService] Préchargement forcé réussi, userInteracted = true')
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[SoundService] Erreur préchargement forcé:', error)
      }
    }
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

