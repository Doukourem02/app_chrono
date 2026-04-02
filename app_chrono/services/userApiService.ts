// Service API pour l'application utilisateur
import { config } from '../config';
import { useAuthStore } from '../store/useAuthStore';
import { logger } from '../utils/logger';

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

class UserApiService {
  /** Une seule requête refresh à la fois - les autres attendent */
  private refreshPromise: Promise<{ token: string | null; revoked?: boolean }> | null = null;

  /**
   * 🚗 GESTION DES CHAUFFEURS
   */

  // Récupérer tous les chauffeurs online
  async getOnlineDrivers(userLocation?: {
    latitude: number;
    longitude: number;
  }): Promise<{
    success: boolean;
    message?: string;
    data?: {
      user_id: string;
      first_name: string;
      last_name: string;
      vehicle_type: string;
      vehicle_plate: string;
      current_latitude: number;
      current_longitude: number;
      is_online: boolean;
      is_available: boolean;
      rating: number;
      total_deliveries: number;
      profile_image_url?: string;
    }[];
  }> {
    try {
      logger.debug('🔍 Récupération chauffeurs online...');

      let url = `${config.apiUrl}/api/drivers/online`;

      if (userLocation) {
        url += `?latitude=${userLocation.latitude}&longitude=${userLocation.longitude}`;
      }

      let response: Response;
      try {
        response = await fetch(url);
      } catch (fetchError: unknown) {
        if (
          fetchError instanceof TypeError &&
          fetchError.message.includes('Network request failed')
        ) {
          logger.warn(
            'Backend inaccessible (getOnlineDrivers) — démarrer chrono_backend et vérifier EXPO_PUBLIC_API_URL (localhost = simulateur Mac uniquement)',
            'userApiService',
            config.apiUrl
          );
          return {
            success: false,
            message:
              'Impossible de joindre le serveur. Vérifiez la connexion et l’URL API (réseau local / VPN).',
            data: [],
          };
        }
        throw fetchError;
      }

      let result: any;
      try {
        result = await response.json();
      } catch {
        logger.warn('Réponse non-JSON (getOnlineDrivers)', 'userApiService', {
          status: response.status,
        });
        return {
          success: false,
          message: `Erreur serveur (${response.status}).`,
          data: [],
        };
      }

      if (!response.ok) {
        throw new Error(result.message || 'Erreur récupération chauffeurs');
      }

      logger.debug(`${result.data?.length || 0} chauffeurs online trouvés`);
      return result;
    } catch (error) {
      logger.error('Erreur getOnlineDrivers:', 'userApiService', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de connexion',
        data: [],
      };
    }
  }

  // Récupérer les détails d'un chauffeur spécifique (deprecated - utiliser getUserProfile)
  async getDriverDetails(driverId: string): Promise<{
    success: boolean;
    message?: string;
    data?: any;
  }> {
    try {
      const response = await fetch(`${config.apiUrl}/api/drivers/${driverId}/details`);

      // Vérifier d'abord le status avant de parser le JSON
      if (response.status === 404) {
        // Si c'est une erreur 404 (driver non trouvé), c'est normal et ne doit pas être loggé comme une erreur critique
        if (__DEV__) {
          logger.warn(`Driver non trouvé: ${driverId}`, 'userApiService');
        }
        return {
          success: false,
          message: 'Chauffeur non trouvé'
        };
      }

      const result = await response.json();

      if (!response.ok) {
        // Pour les autres erreurs, on les traite comme des erreurs réelles
        throw new Error(result.message || 'Erreur récupération détails chauffeur');
      }

      return result;
    } catch (error) {
      // Ne logger que les vraies erreurs (réseau, serveur, etc.), pas les 404
      const errorMessage = error instanceof Error ? error.message : 'Erreur de connexion';
      if (!errorMessage.includes('Chauffeur non trouvé') && !errorMessage.includes('404')) {
        logger.error('Erreur getDriverDetails:', 'userApiService', error);
      }
      return {
        success: false,
        message: errorMessage
      };
    }
  }

  /**
   * 📦 GESTION DES COMMANDES
   */

  // Récupérer l'historique des commandes de l'utilisateur
  async getUserDeliveries(
    userId: string,
    options?: {
      page?: number;
      limit?: number;
      status?: string;
    }
  ): Promise<{
    success: boolean;
    message?: string;
    data?: any[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      const page = options?.page || 1;
      const limit = options?.limit || 20;
      const status = options?.status;

      let url = `${config.apiUrl}/api/deliveries/${userId}?page=${page}&limit=${limit}`;
      if (status) {
        url += `&status=${status}`;
      }

      const token = await this.ensureAccessToken();
      if (!token) {
        // Retourner une erreur gracieuse sans lancer d'exception
        return {
          success: false,
          message: 'Session expirée. Veuillez vous reconnecter.',
          data: []
        };
      }

      let response: Response;
      try {
        response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      } catch (fetchError: any) {
        // Erreur réseau (backend inaccessible, timeout, etc.)
        if (fetchError instanceof TypeError && fetchError.message.includes('Network request failed')) {
          logger.warn('Backend inaccessible - vérifiez que le serveur est démarré sur', 'userApiService', config.apiUrl);
          return {
            success: false,
            message: 'Impossible de se connecter au serveur. Vérifiez votre connexion internet.',
            data: []
          };
        }
        throw fetchError;
      }

      let result: any;
      try {
        result = await response.json();
      } catch {
        // Si la réponse n'est pas du JSON valide, c'est probablement une erreur serveur
        logger.error('Réponse non-JSON reçue:', 'userApiService', { status: response.status, statusText: response.statusText });
        return {
          success: false,
          message: `Erreur serveur (${response.status}). Veuillez réessayer plus tard.`,
          data: []
        };
      }

      if (!response.ok) {
        // Si l'erreur est 401 (non autorisé), c'est probablement un token expiré
        if (response.status === 401) {
          return {
            success: false,
            message: 'Session expirée. Veuillez vous reconnecter.',
            data: []
          };
        }
        return {
          success: false,
          message: result.message || `Erreur récupération commandes (${response.status})`,
          data: []
        };
      }

      return result;
    } catch (error) {
      logger.error('Erreur getUserDeliveries:', 'userApiService', error);

      // Gérer spécifiquement les erreurs réseau
      if (error instanceof TypeError && error.message.includes('Network request failed')) {
        return {
          success: false,
          message: 'Impossible de se connecter au serveur. Vérifiez votre connexion internet.',
          data: []
        };
      }

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de connexion',
        data: []
      };
    }
  }

  // Annuler une commande
  async cancelOrder(orderId: string, currentStatus?: string): Promise<{
    success: boolean;
    message?: string;
    data?: any;
  }> {
    try {
      // Vérifier le statut avant d'essayer d'annuler
      if (currentStatus && currentStatus !== 'pending' && currentStatus !== 'accepted') {
        const statusMessages: Record<string, string> = {
          'picked_up': 'Impossible d\'annuler une commande dont le colis a déjà été récupéré',
          'enroute': 'Impossible d\'annuler une commande en cours de livraison',
          'completed': 'Impossible d\'annuler une commande déjà terminée',
          'cancelled': 'Cette commande a déjà été annulée',
          'declined': 'Cette commande a été refusée',
        };

        return {
          success: false,
          message: statusMessages[currentStatus] || `Impossible d'annuler une commande avec le statut: ${currentStatus}`,
        };
      }

      const token = await this.ensureAccessToken();
      if (!token) {
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }
      const response = await fetch(`${config.apiUrl}/api/deliveries/${orderId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        // Améliorer les messages d'erreur du backend
        let errorMessage = result.message || 'Erreur lors de l\'annulation de la commande';

        if (errorMessage.includes('Cannot cancel order with status')) {
          const statusMatch = errorMessage.match(/status: (\w+)/);
          if (statusMatch) {
            const status = statusMatch[1];
            const statusMessages: Record<string, string> = {
              'picked_up': 'Impossible d\'annuler une commande dont le colis a déjà été récupéré',
              'enroute': 'Impossible d\'annuler une commande en cours de livraison',
              'completed': 'Impossible d\'annuler une commande déjà terminée',
              'cancelled': 'Cette commande a déjà été annulée',
              'declined': 'Cette commande a été refusée',
            };
            errorMessage = statusMessages[status] || errorMessage;
          }
        }

        throw new Error(errorMessage);
      }

      return result;
    } catch (error) {
      // Ne logger comme erreur que les vraies erreurs (réseau, serveur, etc.)
      // Pas les messages d'information attendus (statut invalide, etc.)
      const errorMessage = error instanceof Error ? error.message : 'Erreur de connexion';
      const isExpectedError = errorMessage.includes('Impossible d\'annuler') ||
        errorMessage.includes('déjà été') ||
        errorMessage.includes('Session expirée');

      if (!isExpectedError) {
        logger.error('Erreur cancelOrder:', 'userApiService', error);
      }

      return {
        success: false,
        message: errorMessage
      };
    }
  }

  /**
   * Vérifie et rafraîchit le token d'accès si nécessaire.
   * Règle d'or : timeout / erreur réseau → JAMAIS de logout, on garde la session.
   */
  async ensureAccessToken(): Promise<string | null> {
    try {
      let {
        accessToken,
        refreshToken,
        setTokens,
        logout,
        hydrateTokens,
      } = useAuthStore.getState();

      if (accessToken && this.isTokenValid(accessToken)) {
        return accessToken;
      }

      if (!refreshToken) {
        if (!useAuthStore.persist.hasHydrated()) {
          await new Promise<void>((resolve) => {
            const unsub = useAuthStore.persist.onFinishHydration(() => {
              unsub?.();
              resolve();
            });
          });
        }
        refreshToken = useAuthStore.getState().refreshToken;
        if (!refreshToken) {
          await hydrateTokens();
          refreshToken = useAuthStore.getState().refreshToken;
        }
      }

      if (!refreshToken) {
        logger.warn('Pas de refreshToken disponible', 'userApiService');
        return null;
      }

      if (!this.isTokenValid(refreshToken)) {
        logger.warn('Refresh token expiré - session expirée', 'userApiService');
        logout();
        return null;
      }

      // Une seule refresh à la fois : les appels concurrents attendent le même résultat
      if (!this.refreshPromise) {
        this.refreshPromise = this.doRefreshWithRetry(refreshToken);
      }
      const { token: newAccessToken, revoked } = await this.refreshPromise;
      this.refreshPromise = null;

      if (newAccessToken) {
        setTokens({ accessToken: newAccessToken, refreshToken });
        logger.debug('Token rafraîchi et sauvegardé avec succès', 'userApiService');
        return newAccessToken;
      }

      if (revoked) {
        logger.warn('Token révoqué par le serveur - déconnexion', 'userApiService');
        logout();
      } else {
        logger.warn('Impossible de rafraîchir (réseau?) - on garde la session', 'userApiService');
      }
      return null;
    } catch (error) {
      this.refreshPromise = null;
      logger.warn('Erreur ensureAccessToken (réseau?) - pas de déconnexion', 'userApiService', error);
      return null;
    }
  }

  /** Retry exponentiel : 1s, 2s, 4s. Uniquement sur erreurs réseau. */
  private async doRefreshWithRetry(refreshToken: string): Promise<{ token: string | null; revoked?: boolean }> {
    const MAX_RETRIES = 3;
    const DELAYS = [1000, 2000, 4000];

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const result = await this.refreshAccessToken(refreshToken);
      if (result.token) return result;
      if (result.revoked) return result; // Pas de retry si token invalide

      if (attempt < MAX_RETRIES) {
        logger.debug(`Retry refresh dans ${DELAYS[attempt]}ms (tentative ${attempt + 2}/${MAX_RETRIES + 1})`, 'userApiService');
        await new Promise((r) => setTimeout(r, DELAYS[attempt]));
      } else {
        return result;
      }
    }
    return { token: null, revoked: false };
  }

  /**
   * Vérifie si un token JWT est valide (non expiré)
   * @param token Token JWT à vérifier
   * @returns true si le token est valide, false sinon
   */
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
          logger.debug('Token expiré, expiration:', 'userApiService', new Date(expirationTime).toISOString());
          return false;
        }

        // Token valide si pas expiré
        return true;
      }

      // Si pas d'expiration définie, considérer comme valide (mais ça ne devrait pas arriver)
      logger.warn('Token sans expiration définie', 'userApiService');
      return true;
    } catch (error) {
      logger.error('Erreur vérification token:', 'userApiService', error);
      // En cas d'erreur de décodage, considérer comme invalide
      return false;
    }
  }

  private async refreshAccessToken(refreshToken: string): Promise<{ token: string | null; revoked?: boolean }> {
    const TIMEOUT_MS = 15000;
    try {
      logger.debug('🔄 Tentative de rafraîchissement du token...', 'userApiService');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(`${config.apiUrl}/api/auth-simple/refresh-token`, {
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
        // revoked = true UNIQUEMENT si 401 ET ce n'est PAS une erreur réseau/serveur
        const revoked = response.status === 401 && !networkOrServer;
        if (networkOrServer) {
          logger.warn('Erreur réseau/serveur lors du refresh (pas de logout):', 'userApiService', { status: response.status, message: msg });
        } else {
          logger.error('Erreur HTTP lors du rafraîchissement:', 'userApiService', { status: response.status, message: msg });
        }
        return { token: null, revoked };
      }

      if (!result.success || !result.data?.accessToken) {
        return { token: null, revoked: false };
      }

      logger.debug('Token rafraîchi avec succès', 'userApiService');
      return { token: result.data.accessToken as string };
    } catch (error: any) {
      const msg = error?.message || '';
      const isTimeout = msg.includes('abort') || msg.includes('timeout') || msg.includes('Network request failed');
      if (isTimeout) {
        logger.warn('Timeout lors du refresh (pas de logout):', 'userApiService', config.apiUrl);
      } else {
        logger.warn('Erreur lors du rafraîchissement du token:', 'userApiService', error);
      }
      return { token: null, revoked: false };
    }
  }

  /**
   * 📊 Récupérer les statistiques du client
   * Retourne : nombre de commandes complétées, points de fidélité, économies totales
   */
  async getUserStatistics(userId: string): Promise<{
    success: boolean;
    message?: string;
    data?: {
      completedOrders: number;
      loyaltyPoints: number;
      totalSaved: number;
    };
  }> {
    try {
      const token = await this.ensureAccessToken();
      if (!token) {
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }

      const response = await fetch(`${config.apiUrl}/api/deliveries/${userId}/statistics`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Erreur récupération statistiques');
      }

      return result;
    } catch (error) {
      logger.error('Erreur getUserStatistics:', 'userApiService', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de connexion',
        data: {
          completedOrders: 0,
          loyaltyPoints: 0,
          totalSaved: 0
        }
      };
    }
  }

  /**
   * ⭐ Soumettre une évaluation d'un livreur
   */
  async submitRating(orderId: string, rating: number, comment?: string): Promise<{
    success: boolean;
    message?: string;
    data?: {
      ratingId: string;
      orderId: string;
      driverId: string;
      rating: number;
      comment: string | null;
    };
  }> {
    try {
      const token = await this.ensureAccessToken();
      if (!token) {
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }

      const response = await fetch(`${config.apiUrl}/api/ratings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId,
          rating,
          comment: comment || null
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Erreur lors de l\'enregistrement de l\'évaluation');
      }

      return result;
    } catch (error) {
      logger.error('Erreur submitRating:', 'userApiService', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de connexion'
      };
    }
  }

  /**
   * 🔍 Vérifier si une commande a déjà été évaluée
   */
  async getOrderRating(orderId: string): Promise<{
    success: boolean;
    data?: {
      id: string;
      rating: number;
      comment: string | null;
      createdAt: string;
      updatedAt: string;
    } | null;
  }> {
    try {
      const token = await this.ensureAccessToken();
      if (!token) {
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }

      const response = await fetch(`${config.apiUrl}/api/ratings/order/${orderId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Erreur lors de la récupération de l\'évaluation');
      }

      return result;
    } catch (error) {
      logger.error('Erreur getOrderRating:', 'userApiService', error);
      return {
        success: false,
        data: null
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
      const token = await this.ensureAccessToken();
      if (!token) {
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }

      const response = await fetch(`${config.apiUrl}/api/auth-simple/users/${userId}/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
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
      logger.error('Erreur updateProfile:', 'userApiService', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de connexion'
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
      const token = await this.ensureAccessToken();
      if (!token) {
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }

      const response = await fetch(`${config.apiUrl}/api/auth-simple/users/${userId}/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 404) {
        if (__DEV__) {
          logger.warn(`Utilisateur non trouvé: ${userId}`, 'userApiService');
        }
        return {
          success: false,
          message: 'Utilisateur non trouvé'
        };
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Erreur lors de la récupération du profil');
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur de connexion';
      if (!errorMessage.includes('Utilisateur non trouvé') && !errorMessage.includes('404')) {
        logger.error('Erreur getUserProfile:', 'userApiService', error);
      }
      return {
        success: false,
        message: errorMessage
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
      const token = await this.ensureAccessToken();
      if (!token) {
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }

      const response = await fetch(`${config.apiUrl}/api/auth-simple/users/${userId}/avatar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
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
      logger.error('Erreur uploadAvatar:', 'userApiService', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de connexion'
      };
    }
  }
}

// Export singleton
export const userApiService = new UserApiService();
export default userApiService;