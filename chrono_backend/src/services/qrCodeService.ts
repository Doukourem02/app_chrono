import crypto from 'crypto';
import QRCode from 'qrcode';
import pool from '../config/db.js';
import logger from '../utils/logger.js';

// Secret pour signer les QR codes (doit être dans les variables d'environnement)
const QR_CODE_SECRET = process.env.QR_CODE_SECRET || 'change-me-in-production-minimum-32-characters-long-secret-key';

// Durée de validité des QR codes (48 heures)
const QR_CODE_EXPIRY_HOURS = 48;

export interface QRCodeData {
  orderId: string;
  orderNumber: string;
  recipientName: string;
  recipientPhone: string;
  creatorName: string;
  timestamp: string; // ISO 8601
  signature: string; // HMAC-SHA256
  expiresAt: string; // ISO 8601
}

/** Codes stables pour l’app livreur (messages utilisateur côté client). */
export type QRScanErrorCode =
  | 'QR_INVALID_JSON'
  | 'QR_MALFORMED'
  | 'QR_SIGNATURE_INVALID'
  | 'QR_EXPIRED'
  | 'ORDER_NOT_FOUND'
  | 'DRIVER_NOT_ASSIGNED'
  | 'ORDER_STATUS_INVALID'
  | 'QR_ALREADY_SCANNED'
  | 'SCAN_SERVER_ERROR';

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
  /** Code machine pour affichage précis côté mobile */
  code?: QRScanErrorCode;
}

export class QRCodeService {
  /**
   * Génère la signature cryptographique d'un QR code
   */
  private generateSignature(data: Omit<QRCodeData, 'signature'>): string {
    const payload = JSON.stringify({
      orderId: data.orderId,
      orderNumber: data.orderNumber,
      recipientName: data.recipientName,
      recipientPhone: data.recipientPhone,
      creatorName: data.creatorName,
      timestamp: data.timestamp,
      expiresAt: data.expiresAt,
    });

    return crypto
      .createHmac('sha256', QR_CODE_SECRET)
      .update(payload)
      .digest('hex');
  }

  /**
   * Vérifie la signature d'un QR code
   */
  private verifySignature(data: QRCodeData): boolean {
    const { signature, ...dataWithoutSignature } = data;
    const expectedSignature = this.generateSignature(dataWithoutSignature);
    try {
      const sigBuf = Buffer.from(String(signature), 'hex');
      const expBuf = Buffer.from(expectedSignature, 'hex');
      if (sigBuf.length !== expBuf.length || sigBuf.length === 0) return false;
      return crypto.timingSafeEqual(sigBuf, expBuf);
    } catch {
      return false;
    }
  }

  /**
   * Génère un QR code de livraison pour une commande
   */
  async generateDeliveryQRCode(
    orderId: string,
    orderNumber: string,
    recipientName: string,
    recipientPhone: string,
    creatorName: string
  ): Promise<{ qrCodeData: QRCodeData; qrCodeImage: string }> {
    try {
      const timestamp = new Date().toISOString();
      const expiresAt = new Date(Date.now() + QR_CODE_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

      const qrCodeData: Omit<QRCodeData, 'signature'> = {
        orderId,
        orderNumber,
        recipientName,
        recipientPhone,
        creatorName,
        timestamp,
        expiresAt,
      };

      const signature = this.generateSignature(qrCodeData);
      const completeQRCodeData: QRCodeData = {
        ...qrCodeData,
        signature,
      };

      // Générer l'image QR code en base64
      const qrCodeImage = await QRCode.toDataURL(JSON.stringify(completeQRCodeData), {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 300,
        margin: 2,
      });

      // Sauvegarder le QR code dans la base de données
      await pool.query(
        `UPDATE orders 
         SET delivery_qr_code = $1 
         WHERE id = $2`,
        [JSON.stringify(completeQRCodeData), orderId]
      );

      logger.info(`QR code généré pour la commande ${orderId}`);

      return {
        qrCodeData: completeQRCodeData,
        qrCodeImage,
      };
    } catch (error: any) {
      logger.error('Erreur lors de la génération du QR code:', error);
      throw new Error(`Impossible de générer le QR code: ${error.message}`);
    }
  }

  /**
   * Valide et scanne un QR code
   */
  async scanQRCode(
    qrCodeString: string,
    scannedBy: string,
    location?: { latitude: number; longitude: number },
    deviceInfo?: { platform?: string; model?: string }
  ): Promise<QRCodeScanResult> {
    try {
      // Parser le QR code
      let qrCodeData: QRCodeData;
      try {
        qrCodeData = JSON.parse(qrCodeString);
      } catch (error) {
        return {
          success: false,
          isValid: false,
          code: 'QR_INVALID_JSON',
          error: 'Ce n’est pas un QR Chrono valide (données illisibles). Demandez au client d’afficher à nouveau le QR depuis l’app.',
        };
      }

      const requiredKeys: (keyof QRCodeData)[] = [
        'orderId',
        'orderNumber',
        'signature',
        'expiresAt',
        'timestamp',
      ];
      const missing = requiredKeys.filter(
        (k) => qrCodeData[k] == null || String(qrCodeData[k]).trim() === ''
      );
      if (missing.length > 0) {
        return {
          success: false,
          isValid: false,
          code: 'QR_MALFORMED',
          error: 'QR incomplet ou corrompu. Vérifiez que le client affiche le bon code de livraison.',
        };
      }

      // Vérifier la signature
      if (!this.verifySignature(qrCodeData)) {
        await this.recordInvalidScan(qrCodeData.orderId, scannedBy, 'Signature invalide', location, deviceInfo);
        return {
          success: false,
          isValid: false,
          code: 'QR_SIGNATURE_INVALID',
          error: 'Signature du QR invalide (code falsifié, expiré côté serveur ou mauvaise commande). Utilisez le QR affiché dans l’app client pour cette livraison.',
        };
      }

      // Vérifier l'expiration
      const expiresAt = new Date(qrCodeData.expiresAt);
      if (expiresAt < new Date()) {
        await this.recordInvalidScan(qrCodeData.orderId, scannedBy, 'QR code expiré', location, deviceInfo);
        return {
          success: false,
          isValid: false,
          code: 'QR_EXPIRED',
          error: 'Ce QR a expiré. Le client doit rouvrir « Afficher le QR code » pour en générer un nouveau.',
        };
      }

      // Vérifier que la commande existe
      const orderResult = await pool.query(
        `SELECT id, status, driver_id, user_id 
         FROM orders 
         WHERE id = $1`,
        [qrCodeData.orderId]
      );

      if (orderResult.rows.length === 0) {
        await this.recordInvalidScan(qrCodeData.orderId, scannedBy, 'Commande introuvable', location, deviceInfo);
        return {
          success: false,
          isValid: false,
          code: 'ORDER_NOT_FOUND',
          error: 'Aucune commande ne correspond à ce QR. Vérifiez qu’il s’agit bien de la course en cours.',
        };
      }

      const order = orderResult.rows[0];

      // Vérifier que le livreur est assigné à la commande
      if (order.driver_id !== scannedBy) {
        await this.recordInvalidScan(qrCodeData.orderId, scannedBy, 'Livreur non assigné à cette commande', location, deviceInfo);
        return {
          success: false,
          isValid: false,
          code: 'DRIVER_NOT_ASSIGNED',
          error: 'Ce QR n’est pas pour votre compte : vous n’êtes pas le livreur assigné à cette commande.',
        };
      }

      // Vérifier le statut de la commande
      const st = String(order.status || '').toLowerCase();
      if (!['picked_up', 'delivering'].includes(st)) {
        await this.recordInvalidScan(qrCodeData.orderId, scannedBy, `Statut invalide: ${order.status}`, location, deviceInfo);
        return {
          success: false,
          isValid: false,
          code: 'ORDER_STATUS_INVALID',
          error: `Le scan n’est possible qu’après le ramassage du colis. Statut actuel : ${st || order.status}.`,
        };
      }

      // Vérifier si le QR code a déjà été scanné
      const existingScan = await pool.query(
        `SELECT id FROM qr_code_scans 
         WHERE order_id = $1 AND scanned_by = $2 AND is_valid = true`,
        [qrCodeData.orderId, scannedBy]
      );

      if (existingScan.rows.length > 0) {
        return {
          success: false,
          isValid: false,
          code: 'QR_ALREADY_SCANNED',
          error: 'Ce QR a déjà été enregistré pour vous. Si la course n’est pas terminée côté app, synchronisez ou contactez le support.',
        };
      }

      // Enregistrer le scan valide
      await this.recordValidScan(qrCodeData.orderId, scannedBy, location, deviceInfo);

      // Mettre à jour la commande
      await pool.query(
        `UPDATE orders 
         SET delivery_qr_scanned_at = NOW(),
             delivery_qr_scanned_by = $1,
             status = 'completed',
             completed_at = COALESCE(completed_at, NOW()),
             updated_at = NOW()
         WHERE id = $2`,
        [scannedBy, qrCodeData.orderId]
      );

      logger.info(`QR code scanné avec succès pour la commande ${qrCodeData.orderId} par ${scannedBy}`);

      return {
        success: true,
        isValid: true,
        data: {
          recipientName: qrCodeData.recipientName,
          recipientPhone: qrCodeData.recipientPhone,
          creatorName: qrCodeData.creatorName,
          orderNumber: qrCodeData.orderNumber,
          orderId: qrCodeData.orderId,
        },
      };
    } catch (error: any) {
      logger.error('Erreur lors du scan du QR code:', error);
      return {
        success: false,
        isValid: false,
        code: 'SCAN_SERVER_ERROR',
        error: 'Erreur serveur pendant le scan. Réessayez dans un instant.',
      };
    }
  }

  /**
   * Enregistre un scan valide dans la base de données
   */
  private async recordValidScan(
    orderId: string,
    scannedBy: string,
    location?: { latitude: number; longitude: number },
    deviceInfo?: { platform?: string; model?: string }
  ): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO qr_code_scans 
         (order_id, qr_code_type, scanned_by, location, device_info, is_valid)
         VALUES ($1, 'delivery', $2, $3, $4, true)
         ON CONFLICT (order_id, scanned_by) 
         DO UPDATE SET 
           scanned_at = NOW(),
           location = EXCLUDED.location,
           device_info = EXCLUDED.device_info,
           is_valid = true,
           validation_error = NULL`,
        [
          orderId,
          scannedBy,
          location ? JSON.stringify(location) : null,
          deviceInfo ? JSON.stringify(deviceInfo) : null,
        ]
      );
    } catch (error: any) {
      logger.error('Erreur lors de l\'enregistrement du scan valide:', error);
      throw error;
    }
  }

  /**
   * Enregistre un scan invalide dans la base de données
   */
  private async recordInvalidScan(
    orderId: string,
    scannedBy: string,
    error: string,
    location?: { latitude: number; longitude: number },
    deviceInfo?: { platform?: string; model?: string }
  ): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO qr_code_scans 
         (order_id, qr_code_type, scanned_by, location, device_info, is_valid, validation_error)
         VALUES ($1, 'delivery', $2, $3, $4, false, $5)
         ON CONFLICT (order_id, scanned_by) 
         DO UPDATE SET 
           scanned_at = NOW(),
           location = EXCLUDED.location,
           device_info = EXCLUDED.device_info,
           is_valid = false,
           validation_error = EXCLUDED.validation_error`,
        [
          orderId,
          scannedBy,
          location ? JSON.stringify(location) : null,
          deviceInfo ? JSON.stringify(deviceInfo) : null,
          error,
        ]
      );
    } catch (error: any) {
      logger.error('Erreur lors de l\'enregistrement du scan invalide:', error);
      // Ne pas throw pour éviter de bloquer le flux
    }
  }

  /**
   * Récupère le QR code d'une commande
   */
  async getOrderQRCode(orderId: string): Promise<{ qrCodeData: QRCodeData; qrCodeImage: string } | null> {
    try {
      const result = await pool.query(
        `SELECT delivery_qr_code FROM orders WHERE id = $1`,
        [orderId]
      );

      if (result.rows.length === 0 || !result.rows[0].delivery_qr_code) {
        return null;
      }

      const qrCodeData: QRCodeData = JSON.parse(result.rows[0].delivery_qr_code);

      // Régénérer l'image QR code
      const qrCodeImage = await QRCode.toDataURL(JSON.stringify(qrCodeData), {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 300,
        margin: 2,
      });

      return {
        qrCodeData,
        qrCodeImage,
      };
    } catch (error: any) {
      logger.error('Erreur lors de la récupération du QR code:', error);
      return null;
    }
  }

  /**
   * Récupère l'historique des scans pour une commande
   */
  async getScanHistory(orderId: string): Promise<any[]> {
    try {
      const result = await pool.query(
        `SELECT 
           qs.*,
           u.first_name,
           u.last_name,
           u.email
         FROM qr_code_scans qs
         LEFT JOIN users u ON qs.scanned_by = u.id
         WHERE qs.order_id = $1
         ORDER BY qs.scanned_at DESC`,
        [orderId]
      );

      return result.rows.map((row) => ({
        id: row.id,
        orderId: row.order_id,
        qrCodeType: row.qr_code_type,
        scannedBy: {
          id: row.scanned_by,
          name: row.first_name && row.last_name
            ? `${row.first_name} ${row.last_name}`
            : row.email,
        },
        scannedAt: row.scanned_at,
        location: row.location,
        deviceInfo: row.device_info,
        isValid: row.is_valid,
        validationError: row.validation_error,
      }));
    } catch (error: any) {
      logger.error('Erreur lors de la récupération de l\'historique des scans:', error);
      return [];
    }
  }
}

export default new QRCodeService();

