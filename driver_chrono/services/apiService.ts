// Service API pour communiquer avec le backend Chrono
import { useDriverStore } from '../store/useDriverStore';
import { config } from '../config/index';

// Configuration de l'API
const API_BASE_URL = config.apiUrl;

class ApiService {
  
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
            console.debug(' Token expiré, expiration:', new Date(expirationTime).toISOString());
          }
          return false;
        }
        
        // Token valide si pas expiré
        return true;
      }

      // Si pas d'expiration définie, considérer comme valide (mais ça ne devrait pas arriver)
      if (__DEV__) {
        console.warn('Token sans expiration définie');
      }
      return true;
    } catch (error) {
      if (__DEV__) {
        console.error(' Erreur vérification token:', error);
      }
      // En cas d'erreur de décodage, considérer comme invalide
      return false;
    }
  }

  private async ensureAccessToken(): Promise<{ token: string | null; reason?: 'missing' | 'refresh_failed' }> {
    const { accessToken, refreshToken, setTokens, logout } = useDriverStore.getState();

    // Vérifier si le token existe et s'il n'est pas expiré
    if (accessToken && this.isTokenValid(accessToken)) {
      return { token: accessToken };
    }

    // Si le token est expiré ou absent, essayer de le rafraîchir
    if (!refreshToken) {
      if (__DEV__) {
        console.warn('⚠️ Pas de refreshToken disponible - session expirée');
      }
      // Déconnecter l'utilisateur car la session est expirée
      logout();
      return { token: null, reason: 'missing' };
    }

    // Vérifier si le refresh token est encore valide avant d'essayer de rafraîchir
    if (!this.isTokenValid(refreshToken)) {
      if (__DEV__) {
        console.warn('⚠️ Refresh token expiré - session expirée');
      }
      // Déconnecter l'utilisateur car la session est expirée
      logout();
      return { token: null, reason: 'refresh_failed' };
    }

    const newAccessToken = await this.refreshAccessToken(refreshToken);
    if (newAccessToken) {
      setTokens({ accessToken: newAccessToken, refreshToken });
      return { token: newAccessToken };
    }

    // Impossible de rafraîchir => déconnecter l'utilisateur
    if (__DEV__) {
      console.warn('⚠️ Impossible de rafraîchir le token - session expirée');
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
        console.warn(' Refresh token échoué (driver):', result);
        return null;
      }

      return result.data.accessToken as string;
    } catch (error) {
      console.error('Erreur refreshAccessToken (driver):', error);
      return null;
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
            console.warn(' Backend inaccessible - vérifiez que le serveur est démarré sur', API_BASE_URL);
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
          console.error(' Réponse non-JSON reçue:', response.status, response.statusText);
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
        console.error(' Erreur updateDriverStatus:', error);
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
      console.error(' Erreur updateDriverLocation:', error);
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
        console.debug('🔍 [apiService.getDriverRevenues] Appel API:', url);
      }
      response = await fetch(url, {
        method: 'GET',
        headers,
      });
      
      if (__DEV__) {
        console.debug(' [apiService.getDriverRevenues] Status:', response.status, response.statusText);
      }
      } catch (fetchError: any) {
        // Erreur réseau (backend inaccessible, timeout, etc.)
        if (fetchError instanceof TypeError && fetchError.message.includes('Network request failed')) {
          if (__DEV__) {
            console.warn(' Backend inaccessible - vérifiez que le serveur est démarré sur', API_BASE_URL);
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
          console.error(' Réponse non-JSON reçue:', response.status, response.statusText);
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
            console.warn(' [apiService.getDriverRevenues] Session expirée (401)');
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
        
        if (__DEV__) {
          console.error(' [apiService.getDriverRevenues] Erreur HTTP:', response.status, result);
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
          console.debug('ℹ [apiService.getDriverRevenues] Réponse OK mais données vides (pas de livraisons)');
        }
      }
      
      return result;
    } catch (error) {
      if (__DEV__) {
        console.error(' Erreur getDriverRevenues:', error);
      }
      
      // Gérer spécifiquement les erreurs réseau
      if (error instanceof TypeError && error.message.includes('Network request failed')) {
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
          console.debug(' [apiService.getDriverStatistics] Appel API:', `${API_BASE_URL}/api/drivers/${userId}/statistics`);
        }
        response = await fetch(`${API_BASE_URL}/api/drivers/${userId}/statistics`, {
          method: 'GET',
          headers,
        });
        if (__DEV__) {
          console.debug(' [apiService.getDriverStatistics] Status:', response.status, response.statusText);
        }
      } catch (fetchError: any) {
        if (fetchError instanceof TypeError && fetchError.message.includes('Network request failed')) {
          if (__DEV__) {
            console.warn(' Backend inaccessible - vérifiez que le serveur est démarré sur', API_BASE_URL);
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
          console.error(' Réponse non-JSON reçue:', response.status, response.statusText);
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
            console.warn(' [apiService.getDriverStatistics] Session expirée (401)');
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
          console.error(' [apiService.getDriverStatistics] Erreur HTTP:', response.status, result);
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
          console.debug('ℹ [apiService.getDriverStatistics] Réponse OK mais données vides (pas de livraisons)');
        }
      }

      return result;
    } catch (error) {
      console.error(' Erreur getDriverStatistics:', error);
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
      console.error('❌ Erreur getUserProfile:', error);
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
      console.error('❌ Erreur updateProfile:', error);
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
      console.error('❌ Erreur uploadAvatar:', error);
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
      console.error('❌ Erreur updateDriverVehicle:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de connexion'
      };
    }
  }
}


export const apiService = new ApiService();
export default apiService;
