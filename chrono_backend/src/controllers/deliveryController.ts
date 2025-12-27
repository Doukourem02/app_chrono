import { Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import pool from '../config/db.js';
import fs from 'fs';
import path from 'path';
import { activeOrders, connectedUsers } from '../sockets/orderSocket.js';
import { deductCommissionAfterDelivery } from '../services/commissionService.js';
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

export const createDelivery = async (
  req: RequestWithApp,
  res: Response
): Promise<void> => {
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

export const getUserDeliveries = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { userId } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const status = req.query.status as string | undefined;

  const normalizeDateValue = (value?: string | Date | null): Date | null => {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  // Définir fallbackOrders et sendFallbackOrders avant le try-catch pour qu'ils soient accessibles partout
  const fallbackOrders: any[] = Array.from(activeOrders.values())
    .filter((order: any) => order?.user?.id === userId)
    .filter((order: any) => {
      if (!status || status === 'all') {
        return true;
      }
      return order?.status === status;
    })
    .map((order: any) => {
      const pickup = order?.pickup || order?.pickup_address || null;
      const dropoff = order?.dropoff || order?.dropoff_address || null;

      return {
        id: order.id,
        user_id: order.user?.id,
        driver_id: order.driverId || order.driver?.id || null,
        pickup,
        dropoff,
        pickup_address: pickup,
        dropoff_address: dropoff,
        price: order.price ?? order.price_cfa ?? null,
        price_cfa: order.price ?? order.price_cfa ?? null,
        distance: order.distance ?? order.distance_km ?? null,
        distance_km: order.distance ?? order.distance_km ?? null,
        delivery_method: order.deliveryMethod || order.method || null,
        status: order.status,
        created_at: normalizeDateValue(order.createdAt || order.created_at) || new Date(),
        accepted_at: normalizeDateValue(order.acceptedAt || order.accepted_at),
        completed_at: normalizeDateValue(order.completedAt || order.completed_at),
        cancelled_at: normalizeDateValue(order.cancelledAt || order.cancelled_at),
        proof: order.proof || null,
      };
    })
    .sort((a, b) => {
      const aDate = new Date(a.created_at).getTime();
      const bDate = new Date(b.created_at).getTime();
      return bDate - aDate;
    });

  const sendFallbackOrders = () => {
    const totalFallback = fallbackOrders.length;
    const safeLimit = limit > 0 ? limit : 1;
    const start = (page - 1) * safeLimit;
    const paginatedFallback =
      totalFallback > 0 ? fallbackOrders.slice(start, start + safeLimit) : [];

    res.json({
      success: true,
      data: paginatedFallback,
      pagination: {
        page,
        limit,
        total: totalFallback,
        totalPages: totalFallback > 0 ? Math.ceil(totalFallback / safeLimit) : 0,
      },
      meta: {
        source: 'memory',
      },
    });
  };

  try {

    if (!process.env.DATABASE_URL) {
      logger.warn('DATABASE_URL non configuré pour getUserDeliveries');
      sendFallbackOrders();
      return;
    }

    // Récupérer les commandes avec les informations du driver depuis la table users
    let query = `
      SELECT 
        o.*,
        d.id as driver_user_id,
        d.email as driver_email,
        d.phone as driver_phone,
        d.first_name as driver_first_name,
        d.last_name as driver_last_name,
        d.avatar_url as driver_avatar_url,
        d.role as driver_role
      FROM orders o
      LEFT JOIN users d ON o.driver_id = d.id
      WHERE o.user_id = $1
    `;
    let countQuery = 'SELECT COUNT(*) FROM orders WHERE user_id = $1';
    const queryParams: any[] = [userId];

    if (status && status !== 'all') {
      query += ` AND o.status = $2`;
      countQuery += ` AND status = $2`;
      queryParams.push(status);
    }

    const offset = Math.max((page - 1) * limit, 0);

    query += ` ORDER BY created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);

    const result = await (pool as any).query(query, queryParams);

    const countParams = status && status !== 'all' ? [userId, status] : [userId];
    const countResult = await (pool as any).query(countQuery, countParams);
    const total = parseInt(countResult.rows[0]?.count || '0');

    const rows = result.rows || [];
    if (rows.length === 0 && fallbackOrders.length > 0) {
      sendFallbackOrders();
      return;
    }

    res.json({
      success: true,
      data: rows.map((order: any) => {
        let pickup = order.pickup_address || order.pickup;
        let dropoff = order.dropoff_address || order.dropoff;

        if (typeof pickup === 'string') {
          try {
            pickup = JSON.parse(pickup);
          } catch (e) {
            logger.warn('Erreur parsing pickup:', e);
          }
        }

        if (typeof dropoff === 'string') {
          try {
            dropoff = JSON.parse(dropoff);
          } catch (e) {
            logger.warn('Erreur parsing dropoff:', e);
          }
        }

        let proof = order.proof;
        if (proof && typeof proof === 'string') {
          try {
            proof = JSON.parse(proof);
          } catch (e) {
            logger.warn('Erreur parsing proof:', e);
            proof = null;
          }
        }

        // Construire l'objet driver avec les données de la table users
        const driver = order.driver_user_id ? {
          id: order.driver_user_id,
          first_name: order.driver_first_name,
          last_name: order.driver_last_name,
          email: order.driver_email,
          phone: order.driver_phone,
          avatar_url: order.driver_avatar_url,
          role: order.driver_role,
        } : null;

        return {
          ...order,
          pickup: pickup || order.pickup,
          dropoff: dropoff || order.dropoff,
          pickup_address: pickup,
          dropoff_address: dropoff,
          proof: proof || null,
          driver: driver,
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    logger.error('Erreur getUserDeliveries:', error);
    if (
      error.message &&
      (error.message.includes('SASL') || error.message.includes('password'))
    ) {
      logger.warn('Erreur de connexion DB (peut-être non configurée), retour de données vides');
      sendFallbackOrders();
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message,
    });
  }
};

export const updateDeliveryStatus = async (
  req: RequestWithApp,
  res: Response
): Promise<void> => {
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
      cancelled: [],
    };

    const current = order.status || 'pending';
    if (current === status) {
      res.json({ success: true, message: 'No-op: status already set', order });
      return;
    }

    if (!allowed[current] || !allowed[current].includes(status)) {
      res.status(400).json({
        message: `Invalid status transition from ${current} to ${status}`,
      });
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
      await (pool as any).query('UPDATE deliveries SET status=$1 WHERE id=$2', [
        order.status,
        orderId,
      ]);
    } catch (err: any) {
      logger.warn('Warning: failed to persist delivery status to DB', err.message || err);
    }

    if (status === 'completed') {
      // Prélever la commission pour les livreurs partenaires
      if (driverId) {
        try {
          const commissionResult = await deductCommissionAfterDelivery(
            driverId,
            orderId,
            order.price
          );

          if (commissionResult.success) {
            logger.info(
              `Commission prélevée (REST) pour ${driverId}: ` +
              `${commissionResult.commissionAmount?.toFixed(2)} FCFA ` +
              `(nouveau solde: ${commissionResult.newBalance?.toFixed(2)} FCFA)`
            );
          } else {
            logger.warn(
              `⚠️ Échec prélèvement commission (REST) pour ${driverId}: ${commissionResult.error}`
            );
          }
        } catch (commissionError: any) {
          logger.error(`Erreur prélèvement commission (REST) pour ${driverId}:`, commissionError);
          // Ne pas bloquer la livraison
        }
      }

      setTimeout(() => activeOrders.delete(orderId), 1000 * 60 * 5);
    }

    res.json({ success: true, order });
  } catch (error: any) {
    logger.error('Error updateDeliveryStatus:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const cancelOrder = async (
  req: RequestWithApp,
  res: Response
): Promise<void> => {
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
      const dbResult = await (pool as any).query(
        'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
        [orderId, userId]
      );

      if (!dbResult.rows || dbResult.rows.length === 0) {
        res.status(404).json({ message: 'Order not found or not authorized' });
        return;
      }

    const dbOrder = dbResult.rows[0];
    const currentStatus = dbOrder.status;

    if (currentStatus !== 'pending' && currentStatus !== 'accepted') {
      res.status(400).json({
        message: `Cannot cancel order with status: ${currentStatus}`,
      });
      return;
    }

    await (pool as any).query(
      'UPDATE orders SET status = $1, cancelled_at = NOW() WHERE id = $2',
      ['cancelled', orderId]
    );

    const io = req.app.get('io');
    if (dbOrder.driver_id) {
      const driverSocketId = connectedUsers.get(dbOrder.driver_id);
      if (driverSocketId) {
        io.to(driverSocketId).emit('order:cancelled', {
          orderId,
          reason: 'user_cancelled',
        });
      }
    }

      res.json({
        success: true,
        message: 'Order cancelled successfully',
        order: { ...dbOrder, status: 'cancelled' },
      });
      return;
    }

    if (order.user.id !== userId) {
      res.status(403).json({ message: 'Not authorized to cancel this order' });
      return;
    }

    const currentStatus = order.status;
    if (currentStatus !== 'pending' && currentStatus !== 'accepted') {
      res.status(400).json({
        message: `Cannot cancel order with status: ${currentStatus}`,
      });
      return;
    }

    order.status = 'cancelled';
    (order as any).cancelledAt = new Date();

    try {
      await (pool as any).query(
        'UPDATE orders SET status = $1, cancelled_at = NOW() WHERE id = $2',
        ['cancelled', orderId]
      );
    } catch (err: any) {
      logger.warn('Warning: failed to persist cancellation to DB', err.message || err);
    }

    const io = req.app.get('io');
    if (order.driverId) {
      const driverSocketId = connectedUsers.get(order.driverId);
      if (driverSocketId) {
        io.to(driverSocketId).emit('order:cancelled', {
          orderId,
          reason: 'user_cancelled',
        });
      }
    }

    const userSocketId = connectedUsers.get(order.user.id);
    if (userSocketId) {
      io.to(userSocketId).emit('order:cancelled', { orderId });
    }

    setTimeout(() => activeOrders.delete(orderId), 5000);

    res.json({ success: true, message: 'Order cancelled successfully', order });
  } catch (error: any) {
    logger.error('Error cancelOrder:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const uploadDeliveryProof = async (
  req: RequestWithApp,
  res: Response
): Promise<void> => {
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

    const buffer = Buffer.from(proofBase64, 'base64');
    const proofsDir = path.join(process.cwd(), 'tmp_proofs');
    if (!fs.existsSync(proofsDir)) {
      fs.mkdirSync(proofsDir);
    }

    const filename = `${orderId}_${Date.now()}.${proofType === 'image' ? 'jpg' : 'bin'}`;
    const filepath = path.join(proofsDir, filename);
    fs.writeFileSync(filepath, buffer);

    (order as any).proof = {
      path: filepath,
      uploadedAt: new Date(),
      driverId,
    };

    const io = req.app.get('io');
    const userSocketId = connectedUsers.get(order.user.id);
    if (userSocketId) {
      io.to(userSocketId).emit('order:proof:uploaded', {
        orderId,
        proof: {
          uploadedAt: (order as any).proof.uploadedAt,
        },
      });
    }

    res.json({ success: true, filepath });
  } catch (err: any) {
    logger.error('Error uploadDeliveryProof:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getUserStatistics = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'userId est requis',
      });
      return;
    }

    if (!process.env.DATABASE_URL) {
      logger.warn('DATABASE_URL non configuré pour getUserStatistics');
      res.json({
        success: true,
        data: {
          completedOrders: 0,
          loyaltyPoints: 0,
          totalSaved: 0,
        },
      });
      return;
    }

    try {
      const completedOrdersResult = await (pool as any).query(
        `SELECT COUNT(*) as count FROM orders WHERE user_id = $1 AND status = 'completed'`,
        [userId]
      );
      const completedOrders = parseInt(completedOrdersResult.rows[0]?.count || '0');

      const basePoints = completedOrders;
      const bonusPoints = Math.floor(completedOrders / 10) * 5;
      const loyaltyPoints = basePoints + bonusPoints;

      let remainingAmount = 0;
      try {
        // Calculer le montant total des dettes différées non payées
        // (même logique que getDeferredDebts pour cohérence)
        const deferredDebtsResult = await (pool as any).query(
          `SELECT COALESCE(SUM(amount), 0) as total 
           FROM transactions 
           WHERE user_id = $1 
             AND payment_method_type = 'deferred'
             AND payer_type = 'client'
             AND status = 'delayed'`,
          [userId]
        );
        remainingAmount = parseFloat(deferredDebtsResult.rows[0]?.total || '0');
      } catch (remainingError: any) {
        logger.warn('Erreur calcul montant dettes différées:', remainingError.message);
        remainingAmount = 0;
      }

      res.json({
        success: true,
        data: {
          completedOrders,
          loyaltyPoints,
          totalSaved: remainingAmount,
        },
      });
    } catch (queryError: any) {
      logger.error('Erreur requête getUserStatistics:', queryError);
      res.json({
        success: true,
        data: {
          completedOrders: 0,
          loyaltyPoints: 0,
          totalSaved: 0,
        },
      });
    }
  } catch (error: any) {
    logger.error('Erreur getUserStatistics:', error);
    res.json({
      success: true,
      data: {
        completedOrders: 0,
        loyaltyPoints: 0,
        totalSaved: 0,
      },
    });
  }
};
