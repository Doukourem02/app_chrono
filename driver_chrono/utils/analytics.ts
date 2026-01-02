/**
 * Service d'analytics pour suivre l'usage de l'application chauffeur
 */

import { useDriverStore } from '../store/useDriverStore';
import { logger } from './logger';

export type AnalyticsEvent = 
  // Authentification
  | 'driver_registered'
  | 'driver_logged_in'
  | 'driver_logged_out'
  | 'otp_sent'
  | 'otp_verified'
  
  // Statut
  | 'driver_went_online'
  | 'driver_went_offline'
  | 'driver_status_changed'
  
  // Commandes
  | 'order_received'
  | 'order_accepted'
  | 'order_declined'
  | 'order_started'
  | 'order_picked_up'
  | 'order_completed'
  | 'order_cancelled'
  
  // Navigation
  | 'screen_viewed'
  | 'button_clicked'
  
  // Autres
  | 'location_updated'
  | 'revenue_viewed'
  | 'statistics_viewed'
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

  init(options?: { enabled?: boolean; userId?: string; userProperties?: Record<string, any> }): void {
    this.enabled = options?.enabled ?? true;
    this.userId = options?.userId ?? null;
    this.userProperties = options?.userProperties ?? {};

    // Récupérer l'utilisateur depuis le store si disponible
    const { user, profile } = useDriverStore.getState();
    if (user) {
      const userProperties: Record<string, any> = {
        email: user.email,
        role: 'driver',
      };
      
      // Ajouter le nom si le profil est disponible
      if (profile?.first_name || profile?.last_name) {
        userProperties.name = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
      }
      
      this.setUser(user.id, userProperties);
    }

    if (__DEV__) {
      logger.debug('📊 Analytics service initialisé (driver)', undefined, { enabled: this.enabled });
    }
  }

  setUser(userId: string, properties?: Record<string, any>): void {
    this.userId = userId;
    if (properties) {
      this.userProperties = { ...this.userProperties, ...properties };
    }
  }

  resetUser(): void {
    this.userId = null;
    this.userProperties = {};
  }

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
        app_type: 'driver',
        ...this.userProperties,
      },
    };

    if (__DEV__) {
      logger.debug('📊 Analytics Event (driver):', undefined, { event, properties: eventData.properties });
    }

    this.sendToBackend(eventData).catch(error => {
      if (__DEV__) {
        logger.warn('⚠️ Erreur envoi analytics au backend:', undefined, error);
      }
    });
  }

  screen(screenName: string, properties?: AnalyticsProperties): void {
    this.track('screen_viewed', {
      screen_name: screenName,
      ...properties,
    });
  }

  button(buttonName: string, properties?: AnalyticsProperties): void {
    this.track('button_clicked', {
      button_name: buttonName,
      ...properties,
    });
  }

  error(error: Error | string, properties?: AnalyticsProperties): void {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;

    this.track('error_occurred', {
      error_message: errorMessage,
      error_stack: errorStack,
      ...properties,
    });
  }

  private async sendToBackend(eventData: {
    event: string;
    properties: Record<string, any>;
  }): Promise<void> {
    try {
      const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';
      
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

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

export const analytics = new AnalyticsService();

if (typeof window !== 'undefined' || typeof global !== 'undefined') {
  analytics.init();
}

export default analytics;

