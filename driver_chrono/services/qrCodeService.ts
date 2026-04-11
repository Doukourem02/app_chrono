import { config } from '../config/index';
import { useDriverStore } from '../store/useDriverStore';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { logger } from '../utils/logger';

const API_BASE_URL = config.apiUrl;

export interface QRCodeScanResult {
  success: boolean;
  isValid: boolean;
  data?: {
    recipientName: string;
    recipientPhone: string;
    creatorName: string;
    orderNumber: string;
    orderId: string;
  };
  error?: string;
  /** Aligné sur chrono_backend POST /api/qr-codes/scan */
  code?: string;
}

class QRCodeService {
  /**
   * Récupère le token d'accès depuis le store
   */
  private getAccessToken(): string | null {
    return useDriverStore.getState().accessToken;
  }

  /**
   * Scanne un QR code et valide avec le backend
   */
  async scanQRCode(
    qrCodeData: string,
    location?: { latitude: number; longitude: number }
  ): Promise<QRCodeScanResult> {
    try {
      const token = this.getAccessToken();
      if (!token) {
        return {
          success: false,
          isValid: false,
          code: 'AUTH_REQUIRED',
          error: 'Session expirée ou déconnecté. Reconnectez-vous pour scanner.',
        };
      }

      // Récupérer la localisation si non fournie
      let scanLocation = location;
      if (!scanLocation) {
        try {
          const currentLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          scanLocation = {
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
          };
        } catch (error) {
          logger.warn('Impossible de récupérer la localisation pour le scan:', undefined, error);
          // Continuer sans localisation
        }
      }

      // Informations sur l'appareil
      const deviceInfo = {
        platform: Platform.OS,
        model: Platform.select({
          ios: (Platform.constants as any).systemName || 'iOS',
          android: (Platform.constants as any).Manufacturer || 'Android',
          default: Platform.OS,
        }),
      };

      const response = await fetch(`${API_BASE_URL}/api/qr-codes/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          qrCode: qrCodeData,
          location: scanLocation,
          deviceInfo,
        }),
      });

      const raw = await response.text();
      let result: {
        success?: boolean;
        message?: string;
        error?: string;
        code?: string;
        data?: QRCodeScanResult['data'];
      } = {};
      try {
        result = raw ? JSON.parse(raw) : {};
      } catch {
        return {
          success: false,
          isValid: false,
          code: 'SCAN_BAD_RESPONSE',
          error: 'Réponse serveur illisible. Vérifiez la connexion.',
        };
      }

      if (!response.ok) {
        const code =
          result.code ||
          (response.status === 401 ? 'AUTH_REQUIRED' : 'SCAN_INVALID');
        return {
          success: false,
          isValid: false,
          code,
          error: result.message || result.error || 'Erreur lors du scan',
        };
      }

      // L’API renvoie { success, message, data } — normaliser pour l’UI (success + isValid + data)
      if (result.success && result.data) {
        return {
          success: true,
          isValid: true,
          data: result.data,
        };
      }

      return {
        success: false,
        isValid: false,
        code: result.code || 'SCAN_INVALID',
        error: result.message || 'Réponse scan invalide',
      };
    } catch (error: any) {
      logger.error('Erreur lors du scan du QR code:', undefined, error);
      const msg = String(error?.message || '');
      const isNetwork =
        msg.includes('Network request failed') ||
        msg.includes('Failed to fetch') ||
        msg.includes('internet');
      return {
        success: false,
        isValid: false,
        code: isNetwork ? 'SCAN_NETWORK' : 'SCAN_UNKNOWN',
        error: isNetwork
          ? 'Pas de connexion réseau. Réessayez quand le signal est meilleur.'
          : msg || 'Erreur de connexion',
      };
    }
  }

  /**
   * Récupère le QR code d'une commande (pour affichage)
   */
  async getOrderQRCode(orderId: string): Promise<{ qrCodeImage: string } | null> {
    try {
      const token = this.getAccessToken();
      if (!token) {
        return null;
      }

      const response = await fetch(`${API_BASE_URL}/api/orders/${orderId}/qr-codes`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        return null;
      }

      const result = await response.json();
      return result.data || null;
    } catch (error) {
      logger.error('Erreur lors de la récupération du QR code:', undefined, error);
      return null;
    }
  }
}

export const qrCodeService = new QRCodeService();

