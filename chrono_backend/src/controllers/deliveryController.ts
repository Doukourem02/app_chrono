import { Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import pool from '../config/db.js';
import fs from 'fs';
import path from 'path';
import { activeOrders, connectedUsers } from '../sockets/orderSocket.js';
import logger from '../utils/logger.js';

interface RequestWithApp extends Request {
  app: any;
  user?: {
    id: string;
  };
}

interface CreateDeliveryBody {
  userId: string;
  pickup: any;
  delivery: any;
  method: string;
}

interface UpdateDeliveryStatusBody {
  status: string;
  location?: any;
}

interface UploadProofBody {
  proofBase64: string;
  proofType?: string;
}

export const createDelivery = async (req: RequestWithApp, res: Response): Promise<void> => {
  try {
    const { userId, pickup, delivery, method } = req.body as CreateDeliveryBody;

    const result = await (pool as any).query(
      'INSERT INTO deliveries(user_id, pickup, delivery, method, status) VALUES($1,$2,$3,$4,$5) RETURNING *',
      [userId, pickup, delivery, method, 'pending']
    );

    const io = req.app.get('io');
    io.emit('new_delivery', result.rows[0]);

    res.json(result.rows[0]);
  } catch (error: any) {
    logger.error(error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const getUserDeliveries = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status as string | undefined;
    
    if (!process.env.DATABASE_URL) {
      logger.warn('⚠️ DATABASE_URL non configuré pour getUserDeliveries');
      res.json({
        success: true,
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0
        }
      });
      return;
    }

    let query = `SELECT * FROM orders WHERE user_id = $1`;
    let countQuery = 'SELECT COUNT(*) FROM orders WHERE user_id = $1';
    const queryParams: any[] = [userId];
    
    if (status && status !== 'all') {
      query += ` AND status = $2`;
      countQuery += ` AND status = $2`;
      queryParams.push(status);
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);
    
    const result = await (pool as any).query(query, queryParams);
    
    // Compter le total avec le même filtre
    const countParams = status && status !== 'all' ? [userId, status] : [userId];
    const countResult = await (pool as any).query(countQuery, countParams);
    
    const total = parseInt(countResult.rows[0]?.count || '0');
    
    res.json({
      success: true,
      data: (result.rows || []).map((order: any) => {
        // Parser pickup et dropoff (peuvent être pickup/dropoff ou pickup_address/dropoff_address)
        let pickup = order.pickup_address || order.pickup;
        let dropoff = order.dropoff_address || order.dropoff;
        
        // Parser si c'est une string JSON
        if (typeof pickup === 'string') {
          try {
            pickup = JSON.parse(pickup);
          } catch (e) {
            logger.warn('⚠️ Erreur parsing pickup:', e);
          }
        }
        
        if (typeof dropoff === 'string') {
          try {
            dropoff = JSON.parse(dropoff);
          } catch (e) {
            logger.warn('⚠️ Erreur parsing dropoff:', e);
          }
        }
        
        // Parser proof si présent
        let proof = order.proof;
        if (proof && typeof proof === 'string') {
          try {
            proof = JSON.parse(proof);
          } catch (e) {
            logger.warn('⚠️ Erreur parsing proof:', e);
            proof = null;
          }
        }
        
        return {
          ...order,
          pickup: pickup || order.pickup,
          dropoff: dropoff || order.dropoff,
          pickup_address: pickup, 
          dropoff_address: dropoff, 
          proof: proof || null
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    logger.error('❌ Erreur getUserDeliveries:', error);
    
    if (error.message && (error.message.includes('SASL') || error.message.includes('password'))) {
      logger.warn('⚠️ Erreur de connexion DB (peut-être non configurée), retour de données vides');
      res.json({
        success: true,
        data: [],
        pagination: {
          page: parseInt(req.query.page as string) || 1,
          limit: parseInt(req.query.limit as string) || 20,
          total: 0,
          totalPages: 0
        }
      });
      return;
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Erreur serveur',
      error: error.message 
    });
  }
};

export const updateDeliveryStatus = async (req: RequestWithApp, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const { status, location } = req.body as UpdateDeliveryStatusBody;

    if (!orderId || !status) {
      res.status(400).json({ message: 'orderId and status are required' });
      return;
    }

    const order = activeOrders.get(orderId);
    if (!order) {
      res.status(404).json({ message: 'Order not found or already completed' });
      return;
    }

    const driverId = req.user?.id;
    if (!driverId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    if (order.driverId && order.driverId !== driverId) {
      res.status(403).json({ message: 'Driver not assigned to this order' });
      return;
    }

    const allowed: Record<string, string[]> = {
      pending: ['accepted', 'cancelled'],
      accepted: ['enroute', 'cancelled'],
      enroute: ['picked_up', 'cancelled'],
      picked_up: ['completed', 'cancelled'],
      completed: [],
      cancelled: []
    };

    const current = order.status || 'pending';
    if (current === status) {
      res.json({ success: true, message: 'No-op: status already set', order });
      return;
    }

    if (!allowed[current] || !allowed[current].includes(status)) {
      res.status(400).json({ message: `Invalid status transition from ${current} to ${status}` });
      return;
    }

    order.status = status;
    if (status === 'completed') {
      (order as any).completedAt = new Date();
    }

    const io = req.app.get('io');
    const userSocketId = connectedUsers.get(order.user.id);
    if (userSocketId) {
      io.to(userSocketId).emit('order:status:update', { order, location });
    }

    try {
      await (pool as any).query('UPDATE deliveries SET status=$1 WHERE id=$2', [order.status, orderId]);
    } catch (err: any) {
      logger.warn('Warning: failed to persist delivery status to DB', err.message || err);
    }

    if (status === 'completed') {
      setTimeout(() => activeOrders.delete(orderId), 1000 * 60 * 5);
    }

    res.json({ success: true, order });
  } catch (error: any) {
    logger.error('Error updateDeliveryStatus:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const cancelOrder = async (req: RequestWithApp, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const userId = req.user?.id;

    if (!orderId) {
      res.status(400).json({ message: 'orderId is required' });
      return;
    }
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const order = activeOrders.get(orderId);
    if (!order) {
      const dbResult = await (pool as any).query('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [orderId, userId]);
      if (!dbResult.rows || dbResult.rows.length === 0) {
        res.status(404).json({ message: 'Order not found or not authorized' });
        return;
      }
      const dbOrder = dbResult.rows[0];
      
      const currentStatus = dbOrder.status;
      if (currentStatus !== 'pending' && currentStatus !== 'accepted') {
        res.status(400).json({ 
          message: `Cannot cancel order with status: ${currentStatus}` 
        });
        return;
      }

      // Mettre à jour dans la DB
      await (pool as any).query(
        'UPDATE orders SET status = $1, cancelled_at = NOW() WHERE id = $2',
        ['cancelled', orderId]
      );

      // Émettre un événement socket si le livreur est connecté
      const io = req.app.get('io');
      if (dbOrder.driver_id) {
        const driverSocketId = connectedUsers.get(dbOrder.driver_id);
        if (driverSocketId) {
          io.to(driverSocketId).emit('order:cancelled', { orderId, reason: 'user_cancelled' });
        }
      }

      res.json({ 
        success: true, 
        message: 'Order cancelled successfully',
        order: { ...dbOrder, status: 'cancelled' }
      });
      return;
    }

    // Si la commande est en mémoire (active)
    if (order.user.id !== userId) {
      res.status(403).json({ message: 'Not authorized to cancel this order' });
      return;
    }

    // Vérifier que la commande peut être annulée
    const currentStatus = order.status;
    if (currentStatus !== 'pending' && currentStatus !== 'accepted') {
      res.status(400).json({ 
        message: `Cannot cancel order with status: ${currentStatus}` 
      });
      return;
    }

    // Mettre à jour le statut
    order.status = 'cancelled';
    (order as any).cancelledAt = new Date();

    // Mettre à jour dans la DB
    try {
      await (pool as any).query(
        'UPDATE orders SET status = $1, cancelled_at = NOW() WHERE id = $2',
        ['cancelled', orderId]
      );
    } catch (err: any) {
      logger.warn('Warning: failed to persist cancellation to DB', err.message || err);
    }

    // Émettre un événement socket au livreur si connecté
    const io = req.app.get('io');
    if (order.driverId) {
      const driverSocketId = connectedUsers.get(order.driverId);
      if (driverSocketId) {
        io.to(driverSocketId).emit('order:cancelled', { orderId, reason: 'user_cancelled' });
      }
    }

    // Notifier l'utilisateur
    const userSocketId = connectedUsers.get(order.user.id);
    if (userSocketId) {
      io.to(userSocketId).emit('order:cancelled', { orderId });
    }

    // Retirer de la Map activeOrders après un délai
    setTimeout(() => activeOrders.delete(orderId), 5000);

    res.json({ success: true, message: 'Order cancelled successfully', order });
  } catch (error: any) {
    logger.error('Error cancelOrder:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Upload proof (image/base64) - development helper
export const uploadDeliveryProof = async (req: RequestWithApp, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const { proofBase64, proofType = 'image' } = req.body as UploadProofBody;

    if (!orderId || !proofBase64) {
      res.status(400).json({ message: 'orderId and proofBase64 are required' });
      return;
    }

    const order = activeOrders.get(orderId);
    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    const driverId = req.user?.id;
    if (!driverId || (order.driverId && order.driverId !== driverId)) {
      res.status(403).json({ message: 'Driver not assigned to this order' });
      return;
    }

    // Write base64 to /tmp as a file for dev purposes
    const buffer = Buffer.from(proofBase64, 'base64');
    const proofsDir = path.join(process.cwd(), 'tmp_proofs');
    if (!fs.existsSync(proofsDir)) {
      fs.mkdirSync(proofsDir);
    }
    const filename = `${orderId}_${Date.now()}.${proofType === 'image' ? 'jpg' : 'bin'}`;
    const filepath = path.join(proofsDir, filename);
    fs.writeFileSync(filepath, buffer);

    // Attach proof metadata to order in-memory (dev)
    (order as any).proof = { path: filepath, uploadedAt: new Date(), driverId };

    // Notify user via socket
    const io = req.app.get('io');
    const userSocketId = connectedUsers.get(order.user.id);
    if (userSocketId) {
      io.to(userSocketId).emit('order:proof:uploaded', { 
        orderId, 
        proof: { uploadedAt: (order as any).proof.uploadedAt } 
      });
    }

    res.json({ success: true, filepath });
  } catch (err: any) {
    logger.error('Error uploadDeliveryProof:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * 📊 Récupérer les statistiques d'un client
 * Retourne : nombre de commandes complétées, points de fidélité, économies totales
 */
export const getUserStatistics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'userId est requis'
      });
      return;
    }

    // Vérifier que la connexion DB est configurée
    if (!process.env.DATABASE_URL) {
      logger.warn('⚠️ DATABASE_URL non configuré pour getUserStatistics');
      res.json({
        success: true,
        data: {
          completedOrders: 0,
          loyaltyPoints: 0,
          totalSaved: 0 // Montant restant à payer
        }
      });
      return;
    }

    try {
      // Compter les commandes complétées (status = 'completed')
      const completedOrdersResult = await (pool as any).query(
        `SELECT COUNT(*) as count FROM orders 
        WHERE user_id = $1 AND status = 'completed'`,
        [userId]
      );
      const completedOrders = parseInt(completedOrdersResult.rows[0]?.count || '0');

      // Calculer les points de fidélité : 1 point par commande complétée
      // + bonus : 5 points supplémentaires toutes les 10 commandes
      const basePoints = completedOrders; // 1 point par commande
      const bonusPoints = Math.floor(completedOrders / 10) * 5; // 5 points bonus toutes les 10 commandes
      const loyaltyPoints = basePoints + bonusPoints;

      // Calculer le montant restant à payer (somme des remaining_amount des paiements partiels)
      // On récupère tous les remaining_amount où is_partial = true et où le statut n'est pas 'paid' ou 'refunded'
      let remainingAmount = 0;
      try {
        const remainingAmountResult = await (pool as any).query(
          `SELECT COALESCE(SUM(remaining_amount), 0) as total 
           FROM transactions 
           WHERE user_id = $1 
             AND is_partial = true 
             AND remaining_amount > 0
             AND status NOT IN ('paid', 'refunded', 'cancelled')`,
          [userId]
        );
        remainingAmount = parseFloat(remainingAmountResult.rows[0]?.total || '0');
      } catch (remainingError: any) {
        logger.warn('⚠️ Erreur calcul montant restant:', remainingError.message);
        remainingAmount = 0;
      }

      res.json({
        success: true,
        data: {
          completedOrders,
          loyaltyPoints,
          totalSaved: remainingAmount // Utiliser remainingAmount au lieu de totalSaved
        }
      });
    } catch (queryError: any) {
      logger.error('❌ Erreur requête getUserStatistics:', queryError);
      // En cas d'erreur SQL, retourner un résultat vide plutôt que planter
      res.json({
        success: true,
        data: {
          completedOrders: 0,
          loyaltyPoints: 0,
          totalSaved: 0 // Montant restant à payer
        }
      });
    }
  } catch (error: any) {
    logger.error('❌ Erreur getUserStatistics:', error);
    // Retourner un résultat vide en cas d'erreur pour éviter de crasher l'app
    res.json({
      success: true,
      data: {
        completedOrders: 0,
        loyaltyPoints: 0,
        totalSaved: 0 // Montant restant à payer
      }
    });
  }
};

