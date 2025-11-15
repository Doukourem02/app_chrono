/**
 * Service d'analytics pour suivre l'usage de l'application
 * Supporte plusieurs providers (Mixpanel, Amplitude, etc.) ou peut être utilisé standalone
 */

import { useAuthStore } from '../store/useAuthStore';

export type AnalyticsEvent = 
  // Authentification
  | 'user_registered'
  | 'user_logged_in'
  | 'user_logged_out'
  | 'otp_sent'
  | 'otp_verified'
  
  // Commandes
  | 'order_created'
  | 'order_accepted'
  | 'order_cancelled'
  | 'order_completed'
  | 'order_tracked'
  
  // Paiements
  | 'payment_initiated'
  | 'payment_completed'
  | 'payment_failed'
  | 'payment_method_added'
  
  // Navigation
  | 'screen_viewed'
  | 'button_clicked'
  
  // Recherche
  | 'driver_searched'
  | 'location_searched'
  
  // Autres
  | 'rating_submitted'
  | 'error_occurred'
  | 'app_opened'
  | 'app_closed';

export interface AnalyticsProperties {
  [key: string]: string | number | boolean | null | undefined;
}

class AnalyticsService {
  private enabled: boolean = true;
  private userId: string | null = null;
  private userProperties: Record<string, any> = {};

  /**
   * Initialise le service d'analytics
   */
  init(options?: { enabled?: boolean; userId?: string; userProperties?: Record<string, any> }): void {
    this.enabled = options?.enabled ?? true;
    this.userId = options?.userId ?? null;
    this.userProperties = options?.userProperties ?? {};

    // Récupérer l'utilisateur depuis le store si disponible
    const { user } = useAuthStore.getState();
    if (user) {
      this.setUser(user.id, {
        email: user.email,
        name: (user as any).name || (user as any).full_name || '',
        role: (user as any).role || 'user',
      });
    }

    if (__DEV__) {
      console.log('📊 Analytics service initialisé', { enabled: this.enabled });
    }
  }

  /**
   * Définit l'utilisateur actuel
   */
  setUser(userId: string, properties?: Record<string, any>): void {
    this.userId = userId;
    if (properties) {
      this.userProperties = { ...this.userProperties, ...properties };
    }

    // Ici, vous pouvez envoyer les infos utilisateur à votre provider d'analytics
    // Exemple: Mixpanel.identify(userId);
    // Exemple: Amplitude.setUserId(userId);
  }

  /**
   * Réinitialise l'utilisateur (logout)
   */
  resetUser(): void {
    this.userId = null;
    this.userProperties = {};

    // Ici, vous pouvez réinitialiser l'utilisateur dans votre provider
    // Exemple: Mixpanel.reset();
    // Exemple: Amplitude.clearUserProperties();
  }

  /**
   * Enregistre un événement
   */
  track(event: AnalyticsEvent, properties?: AnalyticsProperties): void {
    if (!this.enabled) {
      return;
    }

    const eventData = {
      event,
      properties: {
        ...properties,
        userId: this.userId,
        timestamp: new Date().toISOString(),
        platform: 'mobile',
        ...this.userProperties,
      },
    };

    // Logger en développement
    if (__DEV__) {
      console.log('📊 Analytics Event:', event, eventData.properties);
    }

    // Ici, vous pouvez envoyer l'événement à votre provider d'analytics
    // Exemple: Mixpanel.track(event, eventData.properties);
    // Exemple: Amplitude.logEvent(event, eventData.properties);
    
    // Pour l'instant, on peut aussi envoyer au backend si nécessaire
    this.sendToBackend(eventData).catch(error => {
      if (__DEV__) {
        console.warn('⚠️ Erreur envoi analytics au backend:', error);
      }
    });
  }

  /**
   * Enregistre un écran visité
   */
  screen(screenName: string, properties?: AnalyticsProperties): void {
    this.track('screen_viewed', {
      screen_name: screenName,
      ...properties,
    });
  }

  /**
   * Enregistre un clic sur un bouton
   */
  button(buttonName: string, properties?: AnalyticsProperties): void {
    this.track('button_clicked', {
      button_name: buttonName,
      ...properties,
    });
  }

  /**
   * Enregistre une erreur
   */
  error(error: Error | string, properties?: AnalyticsProperties): void {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;

    this.track('error_occurred', {
      error_message: errorMessage,
      error_stack: errorStack,
      ...properties,
    });
  }

  /**
   * Envoie les événements au backend (optionnel)
   */
  private async sendToBackend(eventData: {
    event: string;
    properties: Record<string, any>;
  }): Promise<void> {
    try {
      const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';
      
      // Ne pas bloquer l'application si l'envoi échoue
      fetch(`${API_BASE_URL}/api/analytics/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      }).catch(() => {
        // Ignorer les erreurs silencieusement
      });
    } catch {
      // Ignorer les erreurs silencieusement
    }
  }

  /**
   * Active ou désactive l'analytics
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Vérifie si l'analytics est activé
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

// Export singleton
export const analytics = new AnalyticsService();

// Initialiser automatiquement
if (typeof window !== 'undefined' || typeof global !== 'undefined') {
  analytics.init();
}

export default analytics;

