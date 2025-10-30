// Service API pour communiquer avec le backend Chrono
import { DriverUser, DriverProfile } from '../store/useDriverStore';

// Configuration de l'API
const API_BASE_URL = __DEV__ ? 'http://localhost:4000' : 'https://votre-api.com';

class ApiService {
  
  /**
   * 🚚 AUTHENTIFICATION DRIVER
   */
  
  // Inscription chauffeur
  async registerDriver(data: {
    email: string;
    phone: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Promise<{
    success: boolean;
    message: string;
    data?: {
      user: DriverUser;
      profile: DriverProfile;
      token?: string;
    };
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth-simple/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          role: 'driver', // 🎯 Rôle spécifique chauffeur
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Erreur lors de l\'inscription');
      }

      return result;
    } catch (error) {
      console.error('Erreur registerDriver:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de connexion'
      };
    }
  }

  // Connexion chauffeur  
  async loginDriver(email: string, password: string): Promise<{
    success: boolean;
    message: string;
    data?: {
      user: DriverUser;
      profile: DriverProfile;
      token?: string;
    };
  }> {
    try {
      // TODO: Implémenter la route de connexion backend
      const response = await fetch(`${API_BASE_URL}/api/auth-simple/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Erreur de connexion');
      }

      return result;
    } catch (error) {
      console.error('Erreur loginDriver:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de connexion'
      };
    }
  }

  /**
   * 👤 PROFIL CHAUFFEUR
   */
  
  // Récupérer le profil complet
  async getDriverProfile(userId: string): Promise<{
    success: boolean;
    message?: string;
    data?: {
      user: DriverUser;
      profile: DriverProfile;
    };
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth-simple/user/${userId}`);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Erreur de récupération du profil');
      }

      return result;
    } catch (error) {
      console.error('Erreur getDriverProfile:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de connexion'
      };
    }
  }

  // Mettre à jour le profil chauffeur
  async updateDriverProfile(userId: string, updates: Partial<DriverProfile>): Promise<{
    success: boolean;
    message?: string;
    data?: DriverProfile;
  }> {
    try {
      // TODO: Créer route backend pour update profil
      const response = await fetch(`${API_BASE_URL}/api/drivers/${userId}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Erreur de mise à jour');
      }

      return result;
    } catch (error) {
      console.error('Erreur updateDriverProfile:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de connexion'
      };
    }
  }

  /**
   * 📍 GÉOLOCALISATION
   */
  
  // Mettre à jour la position du chauffeur
  async updateDriverLocation(userId: string, location: {
    latitude: number;
    longitude: number;
  }): Promise<{
    success: boolean;
  }> {
    try {
      // TODO: Créer route backend pour localisation
      const response = await fetch(`${API_BASE_URL}/api/drivers/${userId}/location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(location),
      });

      return { success: response.ok };
    } catch (error) {
      console.error('Erreur updateDriverLocation:', error);
      return { success: false };
    }
  }

  // Mettre à jour le statut online/offline
  async updateDriverStatus(userId: string, isOnline: boolean): Promise<{
    success: boolean;
  }> {
    try {
      // TODO: Créer route backend pour statut
      const response = await fetch(`${API_BASE_URL}/api/drivers/${userId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isOnline }),
      });

      return { success: response.ok };
    } catch (error) {
      console.error('Erreur updateDriverStatus:', error);
      return { success: false };
    }
  }

  /**
   * 📊 STATISTIQUES & LIVRAISONS
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
      // TODO: Implémenter l'endpoint /api/drivers/${userId}/stats/today dans le backend
      // Pour l'instant, retourner des données mockées pour éviter l'erreur
      console.log('📊 getTodayStats - utilisation de données mockées en attendant l\'endpoint backend');
      
      return {
        success: true,
        data: {
          deliveries: Math.floor(Math.random() * 10), // 0-9 livraisons
          earnings: Math.floor(Math.random() * 100), // 0-99€
          hours: Math.floor(Math.random() * 8) + 1    // 1-8 heures
        }
      };
      
      /* Code original à réactiver quand l'endpoint sera créé :
      const response = await fetch(`${API_BASE_URL}/api/drivers/${userId}/stats/today`);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Erreur de récupération des stats');
      }

      return result;
      */
    } catch (error) {
      console.error('Erreur getTodayStats:', error);
      return {
        success: false,
        data: { deliveries: 0, earnings: 0, hours: 0 }
      };
    }
  }

  // Récupérer l'historique des livraisons
  async getDeliveryHistory(userId: string, page: number = 1): Promise<{
    success: boolean;
    data?: {
      id: string;
      date: string;
      pickup_address: string;
      delivery_address: string;
      amount: number;
      status: string;
    }[];
  }> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/drivers/${userId}/deliveries?page=${page}`
      );
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Erreur de récupération de l\'historique');
      }

      return result;
    } catch (error) {
      console.error('Erreur getDeliveryHistory:', error);
      return {
        success: false,
        data: []
      };
    }
  }

  /**
   * 🚚 LIVRAISONS EN COURS
   */
  
  // Accepter une livraison
  async acceptDelivery(deliveryId: string, driverId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/deliveries/${deliveryId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ driverId }),
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Erreur acceptDelivery:', error);
      return {
        success: false,
        message: 'Erreur de connexion'
      };
    }
  }

  // Mettre à jour le statut d'une livraison
  async updateDeliveryStatus(deliveryId: string, status: string): Promise<{
    success: boolean;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/deliveries/${deliveryId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      return { success: response.ok };
    } catch (error) {
      console.error('Erreur updateDeliveryStatus:', error);
      return { success: false };
    }
  }
}

// Export singleton
export const apiService = new ApiService();
export default apiService;