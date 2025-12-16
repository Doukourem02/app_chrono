import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import qrCodeService from '../services/qrCodeService.js';
import pool from '../config/db.js';
import logger from '../utils/logger.js';

/**
 * Génère un QR code de livraison pour une commande
 * POST /api/orders/:orderId/qr-codes/generate
 */
export const generateQRCode = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Non authentifié' });
      return;
    }

    // Récupérer les informations de la commande
    const orderResult = await pool.query(
      `SELECT 
         o.id,
         o.user_id,
         o.status,
         o.dropoff,
         u.first_name as creator_first_name,
         u.last_name as creator_last_name,
         u.email as creator_email
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       WHERE o.id = $1`,
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Commande introuvable' });
      return;
    }

    const order = orderResult.rows[0];

    // Vérifier que l'utilisateur est le propriétaire de la commande ou un admin
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
    if (order.user_id !== userId && !isAdmin) {
      res.status(403).json({ success: false, message: 'Accès refusé' });
      return;
    }

    // Extraire les informations du destinataire
    const dropoff = order.dropoff || {};
    const recipientName = dropoff.details?.name || dropoff.details?.recipientName || 'Destinataire';
    const recipientPhone = dropoff.details?.phone || dropoff.details?.recipientPhone || '';

    if (!recipientPhone) {
      res.status(400).json({ success: false, message: 'Numéro de téléphone du destinataire requis' });
      return;
    }

    const creatorName = order.creator_first_name && order.creator_last_name
      ? `${order.creator_first_name} ${order.creator_last_name}`
      : order.creator_email || 'Client';

    // Générer un numéro de commande (utiliser les 8 premiers caractères de l'ID)
    const orderNumber = orderId.substring(0, 8).toUpperCase();

    // Générer le QR code
    const { qrCodeData, qrCodeImage } = await qrCodeService.generateDeliveryQRCode(
      orderId,
      orderNumber,
      recipientName,
      recipientPhone,
      creatorName
    );

    res.json({
      success: true,
      data: {
        qrCodeData,
        qrCodeImage,
        orderId,
        orderNumber,
      },
    });
  } catch (error: any) {
    logger.error('Erreur lors de la génération du QR code:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
};

/**
 * Récupère le QR code d'une commande
 * GET /api/orders/:orderId/qr-codes
 */
export const getQRCode = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Non authentifié' });
      return;
    }

    // Vérifier les permissions
    const orderResult = await pool.query(
      `SELECT user_id, driver_id FROM orders WHERE id = $1`,
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Commande introuvable' });
      return;
    }

    const order = orderResult.rows[0];
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
    const isOwner = order.user_id === userId;
    const isDriver = order.driver_id === userId;

    if (!isOwner && !isDriver && !isAdmin) {
      res.status(403).json({ success: false, message: 'Accès refusé' });
      return;
    }

    const qrCode = await qrCodeService.getOrderQRCode(orderId);

    if (!qrCode) {
      res.status(404).json({ success: false, message: 'QR code non trouvé pour cette commande' });
      return;
    }

    res.json({
      success: true,
      data: qrCode,
    });
  } catch (error: any) {
    logger.error('Erreur lors de la récupération du QR code:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
};

/**
 * Scanne un QR code
 * POST /api/qr-codes/scan
 */
export const scanQRCode = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Non authentifié' });
      return;
    }

    const { qrCode, location, deviceInfo } = req.body;

    if (!qrCode) {
      res.status(400).json({ success: false, message: 'QR code requis' });
      return;
    }

    // Scanner le QR code
    const result = await qrCodeService.scanQRCode(
      qrCode,
      userId,
      location,
      deviceInfo
    );

    if (!result.success || !result.isValid) {
      res.status(400).json({
        success: false,
        message: result.error || 'Scan invalide',
        data: result,
      });
      return;
    }

    res.json({
      success: true,
      message: 'QR code scanné avec succès',
      data: result.data,
    });
  } catch (error: any) {
    logger.error('Erreur lors du scan du QR code:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
};

/**
 * Récupère l'historique des scans pour une commande
 * GET /api/orders/:orderId/qr-codes/scans
 */
export const getScanHistory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Non authentifié' });
      return;
    }

    // Vérifier les permissions (admin uniquement pour l'instant)
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
    if (!isAdmin) {
      res.status(403).json({ success: false, message: 'Accès refusé' });
      return;
    }

    const history = await qrCodeService.getScanHistory(orderId);

    res.json({
      success: true,
      data: history,
    });
  } catch (error: any) {
    logger.error('Erreur lors de la récupération de l\'historique des scans:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
};

