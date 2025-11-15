// Service API pour l'application utilisateur
import { useAuthStore } from '../store/useAuthStore';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || (__DEV__ ? 'http://localhost:4000' : 'https://votre-api.com');

class UserApiService {
  
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
      console.log('🔍 Récupération chauffeurs online...');
      
      let url = `${API_BASE_URL}/api/drivers/online`;
      
      // Ajouter la position utilisateur si fournie
      if (userLocation) {
        url += `?latitude=${userLocation.latitude}&longitude=${userLocation.longitude}`;
      }
      
      const response = await fetch(url);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Erreur récupération chauffeurs');
      }
      
      console.log(`✅ ${result.data?.length || 0} chauffeurs online trouvés`);
      return result;
    } catch (error) {
      console.error('❌ Erreur getOnlineDrivers:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de connexion',
        data: []
      };
    }
  }

  // Récupérer les détails d'un chauffeur spécifique
  async getDriverDetails(driverId: string): Promise<{
    success: boolean;
    message?: string;
    data?: any;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/drivers/${driverId}/details`);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Erreur récupération détails chauffeur');
      }
      
      return result;
    } catch (error) {
      console.error('❌ Erreur getDriverDetails:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de connexion'
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
      
      let url = `${API_BASE_URL}/api/deliveries/${userId}?page=${page}&limit=${limit}`;
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
          console.warn('⚠️ Backend inaccessible - vérifiez que le serveur est démarré sur', API_BASE_URL);
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
        console.error('❌ Réponse non-JSON reçue:', response.status, response.statusText);
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
      console.error('❌ Erreur getUserDeliveries:', error);
      
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
  async cancelOrder(orderId: string): Promise<{
    success: boolean;
    message?: string;
    data?: any;
  }> {
    try {
      const token = await this.ensureAccessToken();
      if (!token) {
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }
      const response = await fetch(`${API_BASE_URL}/api/deliveries/${orderId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Erreur annulation commande');
      }
      
      return result;
    } catch (error) {
      console.error('❌ Erreur cancelOrder:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de connexion'
      };
    }
  }

  private async ensureAccessToken(): Promise<string | null> {
    try {
      const {
        accessToken,
        refreshToken,
        setTokens,
      } = useAuthStore.getState();

      // Vérifier si le token existe et s'il n'est pas expiré
      if (accessToken && this.isTokenValid(accessToken)) {
        return accessToken;
      }

      // Si le token est expiré ou absent, essayer de le rafraîchir
      if (!refreshToken) {
        console.warn('⚠️ Pas de refreshToken disponible - session expirée');
        // Ne pas déconnecter automatiquement, laisser l'appelant gérer l'erreur
        // L'utilisateur pourra se reconnecter si nécessaire
        return null;
      }

      // Vérifier si le refresh token est encore valide
      if (!this.isTokenValid(refreshToken)) {
        console.warn('⚠️ Refresh token expiré - session expirée');
        // Ne pas déconnecter automatiquement, laisser l'appelant gérer l'erreur
        return null;
      }

      console.log('🔄 Token expiré ou absent, rafraîchissement en cours...');
      const newAccessToken = await this.refreshAccessToken(refreshToken);
      if (newAccessToken) {
        setTokens({ accessToken: newAccessToken, refreshToken });
        console.log('✅ Token rafraîchi et sauvegardé avec succès');
        return newAccessToken;
      }

      // Impossible de rafraîchir => retourner null sans déconnecter
      console.warn('⚠️ Impossible de rafraîchir le token - session expirée');
      return null;
    } catch (error) {
      console.error('❌ Erreur ensureAccessToken:', error);
      return null;
    }
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
          console.log('⚠️ Token expiré, expiration:', new Date(expirationTime).toISOString());
          return false;
        }
        
        // Token valide si pas expiré
        return true;
      }

      // Si pas d'expiration définie, considérer comme valide (mais ça ne devrait pas arriver)
      console.warn('⚠️ Token sans expiration définie');
      return true;
    } catch (error) {
      console.error('❌ Erreur vérification token:', error);
      // En cas d'erreur de décodage, considérer comme invalide
      return false;
    }
  }

  private async refreshAccessToken(refreshToken: string): Promise<string | null> {
    try {
      console.log('🔄 Tentative de rafraîchissement du token...');
      
      const response = await fetch(`${API_BASE_URL}/api/auth-simple/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken })
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('❌ Erreur HTTP lors du rafraîchissement:', response.status, result.message);
        return null;
      }

      if (!result.success) {
        console.error('❌ Échec du rafraîchissement:', result.message);
        return null;
      }

      if (!result.data?.accessToken) {
        console.error('❌ Pas de accessToken dans la réponse:', result);
        return null;
      }

      console.log('✅ Token rafraîchi avec succès');
      return result.data.accessToken as string;
    } catch (error) {
      console.error('❌ Erreur réseau lors du rafraîchissement:', error);
      if (error instanceof TypeError && error.message.includes('Network request failed')) {
        console.error('❌ Impossible de se connecter au serveur. Vérifiez que le backend est démarré sur', API_BASE_URL);
      }
      return null;
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

      const response = await fetch(`${API_BASE_URL}/api/deliveries/${userId}/statistics`, {
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
      console.error('❌ Erreur getUserStatistics:', error);
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

      const response = await fetch(`${API_BASE_URL}/api/ratings`, {
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
      console.error('❌ Erreur submitRating:', error);
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

      const response = await fetch(`${API_BASE_URL}/api/ratings/order/${orderId}`, {
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
      console.error('❌ Erreur getOrderRating:', error);
      return {
        success: false,
        data: null
      };
    }
  }
}

// Export singleton
export const userApiService = new UserApiService();
export default userApiService;