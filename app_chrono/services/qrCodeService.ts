import { config } from '../config';
import { useAuthStore } from '../store/useAuthStore';
import { logger } from '../utils/logger';

const API_BASE_URL = config.apiUrl;

export interface QRCodeData {
  qrCodeImage: string;
  qrCodeData?: {
    orderId: string;
    orderNumber: string;
    recipientName: string;
    recipientPhone: string;
    creatorName: string;
    timestamp: string;
    expiresAt: string;
  };
}

class QRCodeService {
  /**
   * Récupère le token d'accès depuis le store
   */
  private getAccessToken(): string | null {
    return useAuthStore.getState().accessToken;
  }

  /**
   * Récupère le QR code d'une commande
   */
  async getOrderQRCode(orderId: string): Promise<QRCodeData | null> {
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
      if (result.success && result.data) {
        return {
          qrCodeImage: result.data.qrCodeImage,
          qrCodeData: result.data.qrCodeData,
        };
      }
      return null;
    } catch (error) {
      logger.error('Erreur lors de la récupération du QR code:', undefined, error);
      return null;
    }
  }

  /**
   * Génère le QR code d'une commande (si pas encore généré)
   */
  async generateOrderQRCode(orderId: string): Promise<QRCodeData | null> {
    try {
      const token = this.getAccessToken();
      if (!token) {
        return null;
      }

      const response = await fetch(`${API_BASE_URL}/api/orders/${orderId}/qr-codes/generate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        return null;
      }

      const result = await response.json();
      if (result.success && result.data) {
        return {
          qrCodeImage: result.data.qrCodeImage,
          qrCodeData: result.data.qrCodeData,
        };
      }
      return null;
    } catch (error) {
      logger.error('Erreur lors de la génération du QR code:', undefined, error);
      return null;
    }
  }
}

export const qrCodeService = new QRCodeService();

