// Service API pour l'application utilisateur
const API_BASE_URL = __DEV__ ? 'http://localhost:4000' : 'https://votre-api.com';

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
}

// Export singleton
export const userApiService = new UserApiService();
export default userApiService;