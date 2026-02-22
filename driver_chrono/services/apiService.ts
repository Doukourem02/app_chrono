// Service API pour communiquer avec le backend Chrono
import { useDriverStore } from '../store/useDriverStore';
import { config } from '../config/index';
import { logger } from '../utils/logger';

const API_BASE_URL = config.apiUrl;

/** Erreurs réseau/serveur : JAMAIS de logout, retry possible */
function isNetworkOrServerError(status: number, message: string): boolean {
  const msg = (message || '').toLowerCase();
  const serverStatuses = [408, 500, 502, 503, 504];
  if (serverStatuses.includes(status)) return true;
  const networkPatterns = [
    'connection terminated', 'connection timeout', 'econnrefused', 'etimedout',
    'enotfound', 'socket hang up', 'fetch failed', 'network request failed',
    'network request timed out', 'service temporairement indisponible',
    'aborted', 'timeout', 'econnreset',
  ];
  return networkPatterns.some((p) => msg.includes(p));
}

class ApiService {
  /** Une seule requête refresh à la fois */
  private refreshPromise: Promise<{ token: string | null; revoked?: boolean }> | null = null;
  
  /**
   * Récupère le token d'accès depuis le store
   */
  private getAccessToken(): string | null {
    return useDriverStore.getState().accessToken;
  }

  private isTokenValid(token: string): boolean {
    try {
      // Décoder le payload du JWT (sans vérification de signature)
      const parts = token.split('.');
      if (parts.length !== 3) {
        return false;
      }

      // Décoder le payload (base64url)
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

      // Vérifier l'expiration (exp est en secondes)
      if (payload.exp) {
        const expirationTime = payload.exp * 1000; // Convertir en millisecondes
        const now = Date.now();
        const isExpired = now >= expirationTime;
        
        if (isExpired) {
          if (__DEV__) {
            logger.debug('Token expiré, expiration:', 'apiService', new Date(expirationTime).toISOString());
          }
          return false;
        }
        
        // Token valide si pas expiré
        return true;
      }

      // Si pas d'expiration définie, considérer comme valide (mais ça ne devrait pas arriver)
      if (__DEV__) {
        logger.warn('Token sans expiration définie', 'apiService');
      }
      return true;
    } catch (error) {
      if (__DEV__) {
        logger.error('Erreur vérification token:', 'apiService', error);
      }
      // En cas d'erreur de décodage, considérer comme invalide
      return false;
    }
  }

  /**
   * Vérifie et rafraîchit le token d'accès si nécessaire.
   * Règle d'or : timeout / erreur réseau → JAMAIS de logout.
   */
  async ensureAccessToken(): Promise<{ token: string | null; reason?: 'missing' | 'refresh_failed' }> {
    try {
      let { accessToken, refreshToken, setTokens, logout, hydrateTokens } = useDriverStore.getState();

      if (accessToken && this.isTokenValid(accessToken)) {
        return { token: accessToken };
      }

      if (!refreshToken) {
        if (!useDriverStore.persist.hasHydrated()) {
          await new Promise<void>((resolve) => {
            const unsub = useDriverStore.persist.onFinishHydration(() => {
              unsub?.();
              resolve();
            });
          });
        }
        refreshToken = useDriverStore.getState().refreshToken;
        if (!refreshToken) {
          await hydrateTokens();
          refreshToken = useDriverStore.getState().refreshToken;
        }
      }

      if (!refreshToken) {
        logger.warn('Pas de refreshToken disponible', 'apiService');
        return { token: null, reason: 'missing' };
      }

      if (!this.isTokenValid(refreshToken)) {
        logger.warn('Refresh token expiré - session expirée', 'apiService');
        logout();
        return { token: null, reason: 'refresh_failed' };
      }

      if (!this.refreshPromise) {
        this.refreshPromise = this.doRefreshWithRetry(refreshToken);
      }
      const { token: newAccessToken, revoked } = await this.refreshPromise;
      this.refreshPromise = null;

      if (newAccessToken) {
        setTokens({ accessToken: newAccessToken, refreshToken });
        logger.debug('Token rafraîchi et sauvegardé avec succès', 'apiService');
        return { token: newAccessToken };
      }

      if (revoked) {
        logger.warn('Token révoqué par le serveur - déconnexion', 'apiService');
        logout();
      } else {
        logger.warn('Impossible de rafraîchir (réseau?) - on garde la session', 'apiService');
      }
      return { token: null, reason: 'refresh_failed' };
    } catch (error) {
      this.refreshPromise = null;
      logger.warn('Erreur ensureAccessToken (réseau?) - pas de déconnexion', 'apiService', error);
      return { token: null };
    }
  }

  /** Retry exponentiel : 1s, 2s, 4s sur erreurs réseau */
  private async doRefreshWithRetry(refreshToken: string): Promise<{ token: string | null; revoked?: boolean }> {
    const MAX_RETRIES = 3;
    const DELAYS = [1000, 2000, 4000];

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const result = await this.refreshAccessToken(refreshToken);
      if (result.token) return result;
      if (result.revoked) return result;

      if (attempt < MAX_RETRIES) {
        logger.debug(`Retry refresh dans ${DELAYS[attempt]}ms (tentative ${attempt + 2}/${MAX_RETRIES + 1})`, 'apiService');
        await new Promise((r) => setTimeout(r, DELAYS[attempt]));
      } else {
        return result;
      }
    }
    return { token: null, revoked: false };
  }

  private async refreshAccessToken(refreshToken: string): Promise<{ token: string | null; revoked?: boolean }> {
    const TIMEOUT_MS = 15000;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(`${API_BASE_URL}/api/auth-simple/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const result = await response.json().catch(() => ({ message: 'Erreur inconnue' }));

      if (!response.ok) {
        const msg = result?.message || '';
        const networkOrServer = isNetworkOrServerError(response.status, msg);
        const revoked = response.status === 401 && !networkOrServer;
        if (networkOrServer) {
          logger.warn('Erreur réseau/serveur lors du refresh (pas de logout):', 'apiService', { status: response.status, message: msg });
        } else {
          logger.error('Erreur HTTP lors du rafraîchissement:', 'apiService', { status: response.status, message: msg });
        }
        return { token: null, revoked };
      }

      if (!result.success || !result.data?.accessToken) {
        return { token: null, revoked: false };
      }

      return { token: result.data.accessToken as string };
    } catch (error: any) {
      const msg = error?.message || '';
      const isTimeout = msg.includes('abort') || msg.includes('timeout') || msg.includes('Network request failed');
      if (isTimeout) {
        logger.warn('Timeout lors du refresh (pas de logout):', 'apiService', API_BASE_URL);
      } else {
        logger.warn('Erreur lors du rafraîchissement du token:', 'apiService', error);
      }
      return { token: null, revoked: false };
    }
  }
  
  
  // Mettre à jour le statut online/offline et optionnellement la position
  async updateDriverStatus(userId: string, statusData: {
    is_online?: boolean;
    is_available?: boolean;
    current_latitude?: number;
    current_longitude?: number;
  }): Promise<{
    success: boolean;
    message?: string;
    data?: any;
  }> {
    try {
      const tokenResult = await this.ensureAccessToken();
      if (!tokenResult.token) {
        return {
          success: false,
          message: tokenResult.reason === 'missing'
            ? 'Session expirée. Veuillez vous reconnecter.'
            : 'Impossible de rafraîchir la session. Veuillez vous reconnecter.',
        };
      }
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenResult.token}`,
      };
      
      let response: Response;
      try {
        response = await fetch(`${API_BASE_URL}/api/drivers/${userId}/status`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(statusData),
        });
      } catch (fetchError: any) {
        // Erreur réseau (backend inaccessible, timeout, etc.)
        if (fetchError instanceof TypeError && fetchError.message.includes('Network request failed')) {
          if (__DEV__) {
            logger.warn(' Backend inaccessible - vérifiez que le serveur est démarré sur', API_BASE_URL);
          }
          return {
            success: false,
            message: 'Impossible de se connecter au serveur. Vérifiez votre connexion internet.',
          };
        }
        throw fetchError;
      }
      
      let result: any;
      try {
        result = await response.json();
      } catch {
        // Si la réponse n'est pas du JSON valide, c'est probablement une erreur serveur
        if (__DEV__) {
          logger.error(' Réponse non-JSON reçue:', undefined, { status: response.status, statusText: response.statusText });
        }
        return {
          success: false,
          message: `Erreur serveur (${response.status}). Veuillez réessayer plus tard.`,
        };
      }
      
      if (!response.ok) {
        // Si l'erreur est 401 (non autorisé), c'est probablement un token expiré
        if (response.status === 401) {
          return {
            success: false,
            message: 'Session expirée. Veuillez vous reconnecter.',
          };
        }
        return {
          success: false,
          message: result.message || `Erreur mise à jour statut (${response.status})`,
        };
      }
      
      return result;
    } catch (error) {
      if (__DEV__) {
        logger.error('Erreur updateDriverStatus:', 'apiService', error);
      }
      
      // Gérer spécifiquement les erreurs réseau
      if (error instanceof TypeError && error.message.includes('Network request failed')) {
        return {
          success: false,
          message: 'Impossible de se connecter au serveur. Vérifiez votre connexion internet.',
        };
      }
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de connexion'
      };
    }
  }

  // Mettre à jour seulement la position du chauffeur
  async updateDriverLocation(userId: string, latitude: number, longitude: number): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      return await this.updateDriverStatus(userId, {
        current_latitude: latitude,
        current_longitude: longitude
      });
    } catch (error) {
      logger.error('Erreur updateDriverLocation:', 'apiService', error);
      return {
        success: false,
        message: 'Erreur mise à jour position'
      };
    }
  }

  // Récupérer les revenus du chauffeur
  async getDriverRevenues(
    userId: string,
    options?: {
      period?: 'today' | 'week' | 'month' | 'all';
      startDate?: string;
      endDate?: string;
    }
  ): Promise<{
    success: boolean;
    message?: string;
    data?: {
      period: string;
      totalEarnings: number;
      totalDeliveries: number;
      totalDistance: number;
      averageEarningPerDelivery: number;
      averageDistance: number;
      earningsByMethod: {
        moto: number;
        vehicule: number;
        cargo: number;
      };
      deliveriesByMethod: {
        moto: number;
        vehicule: number;
        cargo: number;
      };
      earningsByDay: Record<string, number>;
      orders: {
        id: string;
        price: number;
        distance: number;
        delivery_method: string;
        completed_at: string;
        created_at: string;
      }[];
    };
  }> {
    try {
      const tokenResult = await this.ensureAccessToken();
      if (!tokenResult.token) {
        return {
          success: false,
          message: tokenResult.reason === 'missing'
            ? 'Session expirée. Veuillez vous reconnecter.'
            : 'Impossible de rafraîchir la session. Veuillez vous reconnecter.',
          data: {
            period: options?.period || 'today',
            totalEarnings: 0,
            totalDeliveries: 0,
            totalDistance: 0,
            averageEarningPerDelivery: 0,
            averageDistance: 0,
            earningsByMethod: { moto: 0, vehicule: 0, cargo: 0 },
            deliveriesByMethod: { moto: 0, vehicule: 0, cargo: 0 },
            earningsByDay: {},
            orders: [],
          },
        };
      }
      const period = options?.period || 'today';
      
      let url = `${API_BASE_URL}/api/drivers/${userId}/revenues?period=${period}`;
      if (options?.startDate && options?.endDate) {
        url += `&startDate=${options.startDate}&endDate=${options.endDate}`;
      }
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenResult.token}`,
      };
      
      let response: Response;
      try {
      if (__DEV__) {
        logger.debug('🔍 [apiService.getDriverRevenues] Appel API:', 'apiService', url);
      }
      response = await fetch(url, {
        method: 'GET',
        headers,
      });
      
      if (__DEV__) {
        logger.debug('[apiService.getDriverRevenues] Status:', 'apiService', { status: response.status, statusText: response.statusText });
      }
      } catch (fetchError: any) {
        // Erreur réseau (backend inaccessible, timeout, etc.)
        if (fetchError instanceof TypeError && fetchError.message.includes('Network request failed')) {
          if (__DEV__) {
            logger.warn(' Backend inaccessible - vérifiez que le serveur est démarré sur', API_BASE_URL);
          }
          return {
            success: false,
            message: 'Impossible de se connecter au serveur. Vérifiez votre connexion internet.',
            data: {
              period,
              totalEarnings: 0,
              totalDeliveries: 0,
              totalDistance: 0,
              averageEarningPerDelivery: 0,
              averageDistance: 0,
              earningsByMethod: { moto: 0, vehicule: 0, cargo: 0 },
              deliveriesByMethod: { moto: 0, vehicule: 0, cargo: 0 },
              earningsByDay: {},
              orders: [],
            },
          };
        }
        throw fetchError;
      }
      
      let result: any;
      try {
        result = await response.json();
      } catch {
        // Si la réponse n'est pas du JSON valide, c'est probablement une erreur serveur
        if (__DEV__) {
          logger.error(' Réponse non-JSON reçue:', undefined, { status: response.status, statusText: response.statusText });
        }
        return {
          success: false,
          message: `Erreur serveur (${response.status}). Veuillez réessayer plus tard.`,
          data: {
            period,
            totalEarnings: 0,
            totalDeliveries: 0,
            totalDistance: 0,
            averageEarningPerDelivery: 0,
            averageDistance: 0,
            earningsByMethod: { moto: 0, vehicule: 0, cargo: 0 },
            deliveriesByMethod: { moto: 0, vehicule: 0, cargo: 0 },
            earningsByDay: {},
            orders: [],
          },
        };
      }
      
      if (!response.ok) {
        // Si l'erreur est 401 (non autorisé), c'est probablement un token expiré
        if (response.status === 401) {
          if (__DEV__) {
            logger.warn('[apiService.getDriverRevenues] Session expirée (401)', 'apiService');
          }
          return {
            success: false,
            message: 'Session expirée. Veuillez vous reconnecter.',
            data: {
              period,
              totalEarnings: 0,
              totalDeliveries: 0,
              totalDistance: 0,
              averageEarningPerDelivery: 0,
              averageDistance: 0,
              earningsByMethod: { moto: 0, vehicule: 0, cargo: 0 },
              deliveriesByMethod: { moto: 0, vehicule: 0, cargo: 0 },
              earningsByDay: {},
              orders: [],
            },
          };
        }
        
        // Pour les erreurs 500 (problèmes serveur/DB), logger en debug pour éviter le spam
        // Ces erreurs sont souvent temporaires (connexion DB, réseau, etc.)
        if (response.status === 500) {
          if (__DEV__) {
            logger.debug('[apiService.getDriverRevenues] Erreur serveur (500):', 'apiService', result.message || 'Erreur serveur');
          }
        } else if (__DEV__) {
          logger.error('[apiService.getDriverRevenues] Erreur HTTP:', 'apiService', { status: response.status, result });
        }
        return {
          success: false,
          message: result.message || `Erreur récupération revenus (${response.status})`,
          data: {
            period,
            totalEarnings: 0,
            totalDeliveries: 0,
            totalDistance: 0,
            averageEarningPerDelivery: 0,
            averageDistance: 0,
            earningsByMethod: { moto: 0, vehicule: 0, cargo: 0 },
            deliveriesByMethod: { moto: 0, vehicule: 0, cargo: 0 },
            earningsByDay: {},
            orders: [],
          },
        };
      }
      
      // Vérifier si le résultat contient des données valides
      if (__DEV__ && result.success && result.data) {
        const hasData = result.data.totalDeliveries > 0 || 
                      result.data.totalEarnings > 0 || 
                      (result.data.orders && result.data.orders.length > 0);
        if (!hasData) {
          logger.debug('[apiService.getDriverRevenues] Réponse OK mais données vides (pas de livraisons)', 'apiService');
        }
      }
      
      return result;
    } catch (error) {
      // Gérer spécifiquement les erreurs réseau
      if (error instanceof TypeError && error.message.includes('Network request failed')) {
        if (__DEV__) {
          logger.debug('[apiService.getDriverRevenues] Erreur réseau (backend inaccessible)', 'apiService');
        }
        return {
          success: false,
          message: 'Impossible de se connecter au serveur. Vérifiez votre connexion internet.',
          data: {
            period: options?.period || 'today',
            totalEarnings: 0,
            totalDeliveries: 0,
            totalDistance: 0,
            averageEarningPerDelivery: 0,
            averageDistance: 0,
            earningsByMethod: { moto: 0, vehicule: 0, cargo: 0 },
            deliveriesByMethod: { moto: 0, vehicule: 0, cargo: 0 },
            earningsByDay: {},
            orders: [],
          },
        };
      }
      
      // Pour les autres erreurs, logger en debug pour éviter le spam
      if (__DEV__) {
        logger.debug('[apiService.getDriverRevenues] Erreur:', 'apiService', error instanceof Error ? error.message : 'Erreur inconnue');
      }
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de connexion',
        data: {
          period: options?.period || 'today',
          totalEarnings: 0,
          totalDeliveries: 0,
          totalDistance: 0,
          averageEarningPerDelivery: 0,
          averageDistance: 0,
          earningsByMethod: { moto: 0, vehicule: 0, cargo: 0 },
          deliveriesByMethod: { moto: 0, vehicule: 0, cargo: 0 },
          earningsByDay: {},
          orders: [],
        }
      };
    }
  }

  // Récupérer les statistiques du jour (compatibilité)
  async getTodayStats(userId: string): Promise<{
    success: boolean;
    data?: {
      deliveries: number;
      earnings: number;
      hours: number;
    };
  }> {
    try {
      const result = await this.getDriverRevenues(userId, { period: 'today' });
      if (result.success && result.data) {
        return {
          success: true,
          data: {
            deliveries: result.data.totalDeliveries,
            earnings: result.data.totalEarnings,
            hours: 0, // À calculer si nécessaire
          }
        };
      }
      return {
        success: false,
        data: { deliveries: 0, earnings: 0, hours: 0 }
      };
    } catch (error) {
      logger.error('Erreur getTodayStats:', 'apiService', error);
      return {
        success: false,
        data: { deliveries: 0, earnings: 0, hours: 0 }
      };
    }
  }

  
    //Retourne : nombre de livraisons complétées, note moyenne
  
  async getDriverStatistics(userId: string): Promise<{
    success: boolean;
    message?: string;
    data?: {
      completedDeliveries: number;
      averageRating: number;
      totalEarnings?: number;
    };
  }> {
    try {
      const tokenResult = await this.ensureAccessToken();
      if (!tokenResult.token) {
        return {
          success: false,
          message: tokenResult.reason === 'missing'
            ? 'Session expirée. Veuillez vous reconnecter.'
            : 'Impossible de rafraîchir la session. Veuillez vous reconnecter.',
          data: {
            completedDeliveries: 0,
            averageRating: 5.0,
            totalEarnings: 0
          }
        };
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenResult.token}`,
      };

      let response: Response;
      try {
        if (__DEV__) {
          logger.debug('[apiService.getDriverStatistics] Appel API:', 'apiService', `${API_BASE_URL}/api/drivers/${userId}/statistics`);
        }
        response = await fetch(`${API_BASE_URL}/api/drivers/${userId}/statistics`, {
          method: 'GET',
          headers,
        });
        if (__DEV__) {
          logger.debug('[apiService.getDriverStatistics] Status:', 'apiService', { status: response.status, statusText: response.statusText });
        }
      } catch (fetchError: any) {
        if (fetchError instanceof TypeError && fetchError.message.includes('Network request failed')) {
          if (__DEV__) {
            logger.warn(' Backend inaccessible - vérifiez que le serveur est démarré sur', API_BASE_URL);
          }
          return {
            success: false,
            message: 'Impossible de se connecter au serveur. Vérifiez votre connexion internet.',
            data: {
              completedDeliveries: 0,
              averageRating: 5.0,
              totalEarnings: 0
            }
          };
        }
        throw fetchError;
      }

      let result: any;
      try {
        result = await response.json();
      } catch {
        if (__DEV__) {
          logger.error(' Réponse non-JSON reçue:', undefined, { status: response.status, statusText: response.statusText });
        }
        return {
          success: false,
          message: `Erreur serveur (${response.status}). Veuillez réessayer plus tard.`,
          data: {
            completedDeliveries: 0,
            averageRating: 5.0,
            totalEarnings: 0
          }
        };
      }

      if (!response.ok) {
        if (response.status === 401) {
          if (__DEV__) {
            logger.warn('[apiService.getDriverStatistics] Session expirée (401)', 'apiService');
          }
          return {
            success: false,
            message: 'Session expirée. Veuillez vous reconnecter.',
            data: {
              completedDeliveries: 0,
              averageRating: 5.0,
              totalEarnings: 0
            }
          };
        }
        if (__DEV__) {
          logger.error('[apiService.getDriverStatistics] Erreur HTTP:', 'apiService', { status: response.status, result });
        }
        return {
          success: false,
          message: result.message || `Erreur récupération statistiques (${response.status})`,
          data: {
            completedDeliveries: 0,
            averageRating: 5.0,
            totalEarnings: 0
          }
        };
      }

      if (__DEV__ && result.success && result.data) {
        const hasData = result.data.completedDeliveries > 0 || result.data.totalEarnings > 0;
        if (!hasData) {
          logger.debug('[apiService.getDriverStatistics] Réponse OK mais données vides (pas de livraisons)', 'apiService');
        }
      }

      return result;
    } catch (error) {
      logger.error('Erreur getDriverStatistics:', 'apiService', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de connexion',
        data: {
          completedDeliveries: 0,
          averageRating: 5.0,
          totalEarnings: 0
        }
      };
    }
  }

  /**
   * 👤 Récupérer le profil utilisateur complet
   */
  async getUserProfile(userId: string): Promise<{
    success: boolean;
    message?: string;
    data?: {
      id: string;
      email: string;
      phone: string | null;
      first_name: string | null;
      last_name: string | null;
      avatar_url: string | null;
      role: string;
      created_at: string;
      updated_at: string;
    };
  }> {
    try {
      const tokenResult = await this.ensureAccessToken();
      if (!tokenResult.token) {
        return {
          success: false,
          message: tokenResult.reason === 'missing'
            ? 'Session expirée. Veuillez vous reconnecter.'
            : 'Impossible de rafraîchir la session. Veuillez vous reconnecter.',
        };
      }

      const response = await fetch(`${API_BASE_URL}/api/auth-simple/users/${userId}/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenResult.token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Erreur lors de la récupération du profil');
      }

      return result;
    } catch (error) {
      logger.error('Erreur getUserProfile:', 'apiService', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de connexion'
      };
    }
  }

  /**
   * 👤 Mettre à jour le profil utilisateur
   */
  async updateProfile(
    userId: string,
    profileData: {
      first_name?: string;
      last_name?: string;
      phone?: string;
    }
  ): Promise<{
    success: boolean;
    message?: string;
    data?: {
      id: string;
      email: string;
      phone: string | null;
      first_name: string | null;
      last_name: string | null;
      role: string;
      created_at: string;
      updated_at: string;
    };
  }> {
    try {
      const tokenResult = await this.ensureAccessToken();
      if (!tokenResult.token) {
        return {
          success: false,
          message: tokenResult.reason === 'missing'
            ? 'Session expirée. Veuillez vous reconnecter.'
            : 'Impossible de rafraîchir la session. Veuillez vous reconnecter.',
        };
      }

      const response = await fetch(`${API_BASE_URL}/api/auth-simple/users/${userId}/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${tokenResult.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Erreur lors de la mise à jour du profil');
      }

      return result;
    } catch (error) {
      logger.error('Erreur updateProfile:', 'apiService', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de connexion'
      };
    }
  }

  /**
   * 📸 Uploader un avatar
   */
  async uploadAvatar(
    userId: string,
    imageBase64: string,
    mimeType: string = 'image/jpeg'
  ): Promise<{
    success: boolean;
    message?: string;
    data?: {
      avatar_url: string;
      user: {
        id: string;
        email: string;
        phone: string | null;
        first_name: string | null;
        last_name: string | null;
        avatar_url: string | null;
        role: string;
        created_at: string;
        updated_at: string;
      };
    };
  }> {
    try {
      const tokenResult = await this.ensureAccessToken();
      if (!tokenResult.token) {
        return {
          success: false,
          message: tokenResult.reason === 'missing'
            ? 'Session expirée. Veuillez vous reconnecter.'
            : 'Impossible de rafraîchir la session. Veuillez vous reconnecter.',
        };
      }

      const response = await fetch(`${API_BASE_URL}/api/auth-simple/users/${userId}/avatar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenResult.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64,
          mimeType,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Erreur lors de l\'upload de l\'avatar');
      }

      return result;
    } catch (error) {
      logger.error('Erreur uploadAvatar:', undefined, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de connexion'
      };
    }
  }

  /**
   * 🚗 Mettre à jour les informations du véhicule du driver
   */
  async updateDriverVehicle(
    userId: string,
    vehicleData: {
      vehicle_type?: 'moto' | 'vehicule' | 'cargo';
      vehicle_plate?: string;
      vehicle_brand?: string;
      vehicle_model?: string;
      vehicle_color?: string;
      license_number?: string;
    }
  ): Promise<{
    success: boolean;
    message?: string;
    data?: {
      vehicle_type: 'moto' | 'vehicule' | 'cargo';
      vehicle_plate: string | null;
      vehicle_brand: string | null;
      vehicle_model: string | null;
      vehicle_color: string | null;
      license_number: string | null;
    };
  }> {
    try {
      const tokenResult = await this.ensureAccessToken();
      if (!tokenResult.token) {
        return {
          success: false,
          message: tokenResult.reason === 'missing'
            ? 'Session expirée. Veuillez vous reconnecter.'
            : 'Impossible de rafraîchir la session. Veuillez vous reconnecter.',
        };
      }

      const response = await fetch(`${API_BASE_URL}/api/drivers/${userId}/vehicle`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${tokenResult.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(vehicleData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Erreur lors de la mise à jour du véhicule');
      }

      return result;
    } catch (error) {
      logger.error('Erreur updateDriverVehicle:', 'apiService', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de connexion'
      };
    }
  }

  /**
   * 📄 Récupérer les documents légaux d'un véhicule
   */
  async getVehicleDocuments(vehiclePlate: string): Promise<{
    success: boolean;
    message?: string;
    data?: {
      id: string;
      vehicle_plate: string;
      document_type: string;
      document_number: string | null;
      issue_date: string | null;
      expiry_date: string | null;
      document_url: string | null;
      is_valid: boolean;
      notes: string | null;
      created_at: string;
      updated_at: string;
    }[];
  }> {
    try {
      const tokenResult = await this.ensureAccessToken();
      if (!tokenResult.token) {
        return {
          success: false,
          message: tokenResult.reason === 'missing'
            ? 'Session expirée. Veuillez vous reconnecter.'
            : 'Impossible de rafraîchir la session. Veuillez vous reconnecter.',
        };
      }

      const response = await fetch(`${API_BASE_URL}/api/fleet/vehicles/${encodeURIComponent(vehiclePlate)}/documents`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenResult.token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Erreur lors de la récupération des documents');
      }

      return result;
    } catch (error) {
      logger.error('Erreur getVehicleDocuments:', 'apiService', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de connexion'
      };
    }
  }

  /**
   * 📄 Uploader un document légal (carte grise, assurance, etc.)
   */
  async uploadVehicleDocument(
    vehiclePlate: string,
    documentType: 'carte_grise' | 'assurance' | 'controle_technique' | 'permis_conduire',
    documentData: {
      document_number?: string;
      issue_date?: string;
      expiry_date?: string;
      imageBase64?: string;
      mimeType?: string;
      notes?: string;
    }
  ): Promise<{
    success: boolean;
    message?: string;
    data?: {
      id: string;
      vehicle_plate: string;
      document_type: string;
      document_number: string | null;
      issue_date: string | null;
      expiry_date: string | null;
      document_url: string | null;
      is_valid: boolean;
      notes: string | null;
      created_at: string;
      updated_at: string;
    };
  }> {
    try {
      const tokenResult = await this.ensureAccessToken();
      if (!tokenResult.token) {
        return {
          success: false,
          message: tokenResult.reason === 'missing'
            ? 'Session expirée. Veuillez vous reconnecter.'
            : 'Impossible de rafraîchir la session. Veuillez vous reconnecter.',
        };
      }

      // Enregistrer ou mettre à jour le document (l'upload de l'image est géré côté backend)
      const response = await fetch(`${API_BASE_URL}/api/fleet/vehicles/${encodeURIComponent(vehiclePlate)}/documents`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenResult.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document_type: documentType,
          document_number: documentData.document_number,
          issue_date: documentData.issue_date,
          expiry_date: documentData.expiry_date,
          imageBase64: documentData.imageBase64,
          mimeType: documentData.mimeType || 'image/jpeg',
          is_valid: true,
          notes: documentData.notes,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Erreur lors de l\'enregistrement du document');
      }

      return result;
    } catch (error) {
      logger.error('Erreur uploadVehicleDocument:', 'apiService', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de connexion'
      };
    }
  }

  /**
   * 🔄 Mettre à jour le type de livreur (internal/partner)
   */
  async updateDriverType(
    userId: string,
    driverType: 'internal' | 'partner'
  ): Promise<{
    success: boolean;
    message?: string;
    data?: {
      driver_type: 'internal' | 'partner';
    };
  }> {
    try {
      const tokenResult = await this.ensureAccessToken();
      if (!tokenResult.token) {
        return {
          success: false,
          message: tokenResult.reason === 'missing'
            ? 'Session expirée. Veuillez vous reconnecter.'
            : 'Impossible de rafraîchir la session. Veuillez vous reconnecter.',
        };
      }

      const response = await fetch(`${API_BASE_URL}/api/drivers/${userId}/driver-type`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${tokenResult.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ driver_type: driverType }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Erreur lors de la mise à jour du type de livreur');
      }

      return result;
    } catch (error) {
      logger.error('Erreur updateDriverType:', 'apiService', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de connexion'
      };
    }
  }

  /**
   * 🚗 Récupérer le profil driver complet
   */
  async getDriverProfile(userId: string): Promise<{
    success: boolean;
    message?: string;
    data?: any;
  }> {
    try {
      const tokenResult = await this.ensureAccessToken();
      if (!tokenResult.token) {
        return {
          success: false,
          message: tokenResult.reason === 'missing'
            ? 'Session expirée. Veuillez vous reconnecter.'
            : 'Impossible de rafraîchir la session. Veuillez vous reconnecter.',
        };
      }

      const response = await fetch(`${API_BASE_URL}/api/drivers/${userId}/details`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenResult.token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Erreur lors de la récupération du profil driver');
      }

      return result;
    } catch (error) {
      logger.error('Erreur getDriverProfile:', 'apiService', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de connexion'
      };
    }
  }

  /**
   * 💳 Récupérer le solde commission
   */
  async getCommissionBalance(userId: string): Promise<{
    success: boolean;
    message?: string;
    data?: {
      balance: number;
      minimum_balance: number;
      commission_rate: number;
      is_suspended: boolean;
      last_updated: string;
    };
  }> {
    try {
      const tokenResult = await this.ensureAccessToken();
      if (!tokenResult.token) {
        return {
          success: false,
          message: tokenResult.reason === 'missing'
            ? 'Session expirée. Veuillez vous reconnecter.'
            : 'Impossible de rafraîchir la session. Veuillez vous reconnecter.',
        };
      }

      const response = await fetch(`${API_BASE_URL}/api/commission/${userId}/balance`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenResult.token}`,
          'Content-Type': 'application/json',
        },
      });

      // Vérifier le Content-Type avant de parser
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        // Si la route n'existe pas encore, retourner une erreur explicite
        if (response.status === 404 || text.includes('<html') || text.includes('<!DOCTYPE')) {
          return {
            success: false,
            message: 'La fonctionnalité commission n\'est pas encore disponible. Veuillez contacter le support.',
          };
        }
        throw new Error(`Réponse invalide du serveur: ${text.substring(0, 100)}`);
      }

      const result = await response.json();

      if (!response.ok) {
        const errorMessage = result.message || result.error || 'Erreur lors de la récupération du solde';
        throw new Error(errorMessage);
      }

      if (!result.success) {
        throw new Error(result.message || 'Erreur lors de la récupération du solde');
      }

      return result;
    } catch (error) {
      logger.error('Erreur getCommissionBalance:', 'apiService', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Erreur de connexion au serveur. Veuillez réessayer.';
      return {
        success: false,
        message: errorMessage
      };
    }
  }

  /**
   * 💳 Récupérer l'historique des transactions commission
   */
  async getCommissionTransactions(userId: string, limit: number = 50): Promise<{
    success: boolean;
    message?: string;
    data?: {
      id: string;
      type: 'recharge' | 'deduction' | 'refund';
      amount: number;
      balance_before: number;
      balance_after: number;
      order_id?: string;
      payment_method?: string;
      status: 'pending' | 'completed' | 'failed';
      created_at: string;
    }[];
  }> {
    try {
      const tokenResult = await this.ensureAccessToken();
      if (!tokenResult.token) {
        return {
          success: false,
          message: tokenResult.reason === 'missing'
            ? 'Session expirée. Veuillez vous reconnecter.'
            : 'Impossible de rafraîchir la session. Veuillez vous reconnecter.',
        };
      }

      const response = await fetch(`${API_BASE_URL}/api/commission/${userId}/transactions?limit=${limit}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenResult.token}`,
          'Content-Type': 'application/json',
        },
      });

      // Vérifier le Content-Type avant de parser
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        if (response.status === 404 || text.includes('<html') || text.includes('<!DOCTYPE')) {
          return {
            success: false,
            message: 'La fonctionnalité commission n\'est pas encore disponible.',
          };
        }
        throw new Error(`Réponse invalide du serveur: ${text.substring(0, 100)}`);
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Erreur lors de la récupération des transactions');
      }

      return result;
    } catch (error) {
      logger.error('Erreur getCommissionTransactions:', 'apiService', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de connexion'
      };
    }
  }

  /**
   * 💳 Recharger le compte commission
   */
  async rechargeCommission(
    userId: string,
    amount: number,
    method: 'orange_money' | 'wave'
  ): Promise<{
    success: boolean;
    message?: string;
    data?: {
      transactionId: string;
      paymentUrl?: string;
    };
  }> {
    try {
      const tokenResult = await this.ensureAccessToken();
      if (!tokenResult.token) {
        return {
          success: false,
          message: tokenResult.reason === 'missing'
            ? 'Session expirée. Veuillez vous reconnecter.'
            : 'Impossible de rafraîchir la session. Veuillez vous reconnecter.',
        };
      }

      const response = await fetch(`${API_BASE_URL}/api/commission/${userId}/recharge`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenResult.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount, method }),
      });

      // Vérifier le Content-Type avant de parser
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        if (response.status === 404 || text.includes('<html') || text.includes('<!DOCTYPE')) {
          return {
            success: false,
            message: 'La fonctionnalité commission n\'est pas encore disponible.',
          };
        }
        throw new Error(`Réponse invalide du serveur: ${text.substring(0, 100)}`);
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Erreur lors de la recharge');
      }

      return result;
    } catch (error) {
      logger.error('Erreur rechargeCommission:', 'apiService', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de connexion'
      };
    }
  }
}


export const apiService = new ApiService();
export default apiService;
