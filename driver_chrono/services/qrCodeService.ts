import { config } from '../config/index';
import { useDriverStore } from '../store/useDriverStore';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

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
          error: 'Non authentifié',
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
          console.warn('Impossible de récupérer la localisation pour le scan:', error);
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

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          isValid: false,
          error: result.message || result.error || 'Erreur lors du scan',
        };
      }

      return result;
    } catch (error: any) {
      console.error('Erreur lors du scan du QR code:', error);
      return {
        success: false,
        isValid: false,
        error: error.message || 'Erreur de connexion',
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
      console.error('Erreur lors de la récupération du QR code:', error);
      return null;
    }
  }
}

export const qrCodeService = new QRCodeService();

