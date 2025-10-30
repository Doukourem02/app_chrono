// Service API pour communiquer avec le backend Chrono

// Configuration de l'API
const API_BASE_URL = __DEV__ ? 'http://localhost:4000' : 'https://votre-api.com';

class ApiService {
  
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
      const response = await fetch(`${API_BASE_URL}/api/drivers/${userId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
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
  
  // Récupérer les statistiques du jour
  async getTodayStats(userId: string): Promise<{
    success: boolean;
    data?: {
      deliveries: number;
      earnings: number;
      hours: number;
    };
  }> {
    try {
      return {
        success: true,
        data: {
          deliveries: Math.floor(Math.random() * 10),
          earnings: Math.floor(Math.random() * 100),
          hours: Math.floor(Math.random() * 8) + 1
        }
      };
    } catch (error) {
      console.error('Erreur getTodayStats:', error);
      return {
        success: false,
        data: { deliveries: 0, earnings: 0, hours: 0 }
      };
    }
  }
}

// Export singleton
export const apiService = new ApiService();
export default apiService;
