// Service API pour communiquer avec le backend Chrono
import { useDriverStore } from '../store/useDriverStore';

// Configuration de l'API
const API_BASE_URL = __DEV__ ? 'http://localhost:4000' : 'https://votre-api.com';

class ApiService {
  
  /**
   * Récupère le token d'accès depuis le store
   */
  private getAccessToken(): string | null {
    return useDriverStore.getState().accessToken;
  }

  private async ensureAccessToken(): Promise<{ token: string | null; reason?: 'missing' | 'refresh_failed' }> {
    const { accessToken, refreshToken, setTokens, logout } = useDriverStore.getState();

    if (accessToken) {
      return { token: accessToken };
    }

    if (!refreshToken) {
      return { token: null, reason: 'missing' };
    }

    const newAccessToken = await this.refreshAccessToken(refreshToken);
    if (newAccessToken) {
      setTokens({ accessToken: newAccessToken, refreshToken });
      return { token: newAccessToken };
    }

    logout();
    return { token: null, reason: 'refresh_failed' };
  }

  private async refreshAccessToken(refreshToken: string): Promise<string | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth-simple/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      const result = await response.json();

      if (!response.ok || !result.success || !result.data?.accessToken) {
        console.warn('⚠️ Refresh token échoué (driver):', result);
        return null;
      }

      return result.data.accessToken as string;
    } catch (error) {
      console.error('❌ Erreur refreshAccessToken (driver):', error);
      return null;
    }
  }
  
  /**
   * 📍 GÉOLOCALISATION & STATUT CHAUFFEUR
   */
  
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
      
      const response = await fetch(`${API_BASE_URL}/api/drivers/${userId}/status`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(statusData),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Erreur mise à jour statut');
      }
      
      return result;
    } catch (error) {
      console.error('❌ Erreur updateDriverStatus:', error);
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
      console.error('❌ Erreur updateDriverLocation:', error);
      return {
        success: false,
        message: 'Erreur mise à jour position'
      };
    }
  }

  /**
   * 📊 STATISTIQUES
   */
  
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
      orders: Array<{
        id: string;
        price: number;
        distance: number;
        delivery_method: string;
        completed_at: string;
        created_at: string;
      }>;
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
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Erreur récupération revenus');
      }
      
      return result;
    } catch (error) {
      console.error('❌ Erreur getDriverRevenues:', error);
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
      console.error('Erreur getTodayStats:', error);
      return {
        success: false,
        data: { deliveries: 0, earnings: 0, hours: 0 }
      };
    }
  }

  /**
   * 📊 Récupérer les statistiques du livreur
   * Retourne : nombre de livraisons complétées, note moyenne
   */
  async getDriverStatistics(userId: string): Promise<{
    success: boolean;
    message?: string;
    data?: {
      completedDeliveries: number;
      averageRating: number;
    };
  }> {
    try {
      const accessToken = await this.ensureAccessToken();
      if (!accessToken) {
        return {
          success: false,
          message: 'Session expirée. Veuillez vous reconnecter.',
          data: {
            completedDeliveries: 0,
            averageRating: 5.0
          }
        };
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      };

      const response = await fetch(`${API_BASE_URL}/api/drivers/${userId}/statistics`, {
        method: 'GET',
        headers,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Erreur récupération statistiques');
      }

      return result;
    } catch (error) {
      console.error('❌ Erreur getDriverStatistics:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de connexion',
        data: {
          completedDeliveries: 0,
          averageRating: 5.0
        }
      };
    }
  }
}

// Export singleton
export const apiService = new ApiService();
export default apiService;
