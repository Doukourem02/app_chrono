// Service API pour l'application utilisateur
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
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Erreur récupération commandes');
      }
      
      return result;
    } catch (error) {
      console.error('❌ Erreur getUserDeliveries:', error);
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
      const { useAuthStore } = require('../store/useAuthStore');
      const {
        accessToken,
        refreshToken,
        setTokens,
        logout,
      } = useAuthStore.getState();

      if (accessToken) {
        return accessToken;
      }

      if (!refreshToken) {
        return null;
      }

      const newAccessToken = await this.refreshAccessToken(refreshToken);
      if (newAccessToken) {
        setTokens({ accessToken: newAccessToken, refreshToken });
        return newAccessToken;
      }

      // Impossible de rafraîchir => déconnexion propre
      logout();
      return null;
    } catch (error) {
      console.error('❌ Erreur ensureAccessToken:', error);
      return null;
    }
  }

  private async refreshAccessToken(refreshToken: string): Promise<string | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth-simple/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken })
      });

      const result = await response.json();

      if (!response.ok || !result.success || !result.data?.accessToken) {
        return null;
      }

      return result.data.accessToken as string;
    } catch (error) {
      console.error('❌ Erreur refreshAccessToken:', error);
      return null;
    }
  }
}

// Export singleton
export const userApiService = new UserApiService();
export default userApiService;