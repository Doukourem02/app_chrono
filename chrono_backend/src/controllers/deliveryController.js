import pool from '../config/db.js';
import fs from 'fs';
import path from 'path';
import { activeOrders, connectedUsers } from '../sockets/orderSocket.js';
import logger from '../utils/logger.js';

export const createDelivery = async (req, res) => {
  try {
    const { userId, pickup, delivery, method } = req.body;

    const result = await pool.query(
      'INSERT INTO deliveries(user_id, pickup, delivery, method, status) VALUES($1,$2,$3,$4,$5) RETURNING *',
      [userId, pickup, delivery, method, 'pending']
    );

    // Émettre un événement Socket.io aux livreurs connectés
    const io = req.app.get('io');
    io.emit('new_delivery', result.rows[0]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const getUserDeliveries = async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status; // Filtre par statut optionnel
    
    // Vérifier que la connexion DB est configurée
    if (!process.env.DATABASE_URL) {
      console.warn('⚠️ DATABASE_URL non configuré pour getUserDeliveries');
      return res.json({
        success: true,
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0
        }
      });
    }

    // Construire la requête avec filtre de statut si fourni
    let query = `SELECT * FROM orders WHERE user_id = $1`;
    let countQuery = 'SELECT COUNT(*) FROM orders WHERE user_id = $1';
    const queryParams = [userId];
    
    if (status && status !== 'all') {
      query += ` AND status = $2`;
      countQuery += ` AND status = $2`;
      queryParams.push(status);
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);
    
    // Récupérer les commandes avec pagination
    const result = await pool.query(query, queryParams);
    
    // Compter le total avec le même filtre
    const countParams = status && status !== 'all' ? [userId, status] : [userId];
    const countResult = await pool.query(countQuery, countParams);
    
    const total = parseInt(countResult.rows[0].count);
    
    res.json({
      success: true,
      data: result.rows.map(order => ({
        ...order,
        pickup: typeof order.pickup === 'string' ? JSON.parse(order.pickup) : order.pickup,
        dropoff: typeof order.dropoff === 'string' ? JSON.parse(order.dropoff) : order.dropoff,
        proof: order.proof ? (typeof order.proof === 'string' ? JSON.parse(order.proof) : order.proof) : null
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('❌ Erreur getUserDeliveries:', error);
    
    // Si c'est une erreur de connexion DB, retourner un résultat vide plutôt qu'une erreur
    if (error.message && error.message.includes('SASL') || error.message && error.message.includes('password')) {
      console.warn('⚠️ Erreur de connexion DB (peut-être non configurée), retour de données vides');
      return res.json({
        success: true,
        data: [],
        pagination: {
          page: parseInt(req.query.page) || 1,
          limit: parseInt(req.query.limit) || 20,
          total: 0,
          totalPages: 0
        }
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Erreur serveur',
      error: error.message 
    });
  }
};

// Driver updates delivery status via REST fallback
export const updateDeliveryStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, location } = req.body;

    if (!orderId || !status) return res.status(400).json({ message: 'orderId and status are required' });

    const order = activeOrders.get(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found or already completed' });

    // Verify that requester is the assigned driver
    const driverId = req.user?.id;
    if (!driverId) return res.status(401).json({ message: 'Unauthorized' });
    if (order.driverId && order.driverId !== driverId) return res.status(403).json({ message: 'Driver not assigned to this order' });

    // Allowed transitions
    const allowed = {
      pending: ['accepted', 'cancelled'],
      accepted: ['enroute', 'cancelled'],
      enroute: ['picked_up', 'cancelled'],
      picked_up: ['completed', 'cancelled'],
      completed: [],
      cancelled: []
    };

    const current = order.status || 'pending';
    if (current === status) {
      return res.json({ success: true, message: 'No-op: status already set', order });
    }

    if (!allowed[current] || !allowed[current].includes(status)) {
      return res.status(400).json({ message: `Invalid status transition from ${current} to ${status}` });
    }

    // Apply transition
    order.status = status;
    if (status === 'completed') order.completedAt = new Date();

    // Emit socket event to the user if connected
    const io = req.app.get('io');
    const userSocketId = connectedUsers.get(order.user.id);
    if (userSocketId) {
      io.to(userSocketId).emit('order:status:update', { order, location });
    }

    // Persist to DB as a record (optional): insert into deliveries_history or update existing delivery row
    try {
      await pool.query('UPDATE deliveries SET status=$1 WHERE id=$2', [order.status, orderId]);
    } catch (err) {
      // not fatal in dev
      console.warn('Warning: failed to persist delivery status to DB', err.message || err);
    }

    // If completed remove from activeOrders after short delay
    if (status === 'completed') {
      setTimeout(() => activeOrders.delete(orderId), 1000 * 60 * 5);
    }

    return res.json({ success: true, order });
  } catch (error) {
    console.error('Error updateDeliveryStatus:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Cancel order (user)
export const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user?.id;

    if (!orderId) return res.status(400).json({ message: 'orderId is required' });
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    // Vérifier que la commande existe et appartient à l'utilisateur
    const order = activeOrders.get(orderId);
    if (!order) {
      // Vérifier dans la DB si la commande existe
      const dbResult = await pool.query('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [orderId, userId]);
      if (dbResult.rows.length === 0) {
        return res.status(404).json({ message: 'Order not found or not authorized' });
      }
      const dbOrder = dbResult.rows[0];
      
      // Vérifier que la commande peut être annulée
      const currentStatus = dbOrder.status;
      if (currentStatus !== 'pending' && currentStatus !== 'accepted') {
        return res.status(400).json({ 
          message: `Cannot cancel order with status: ${currentStatus}` 
        });
      }

      // Mettre à jour dans la DB
      await pool.query(
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

      return res.json({ 
        success: true, 
        message: 'Order cancelled successfully',
        order: { ...dbOrder, status: 'cancelled' }
      });
    }

    // Si la commande est en mémoire (active)
    if (order.user.id !== userId) {
      return res.status(403).json({ message: 'Not authorized to cancel this order' });
    }

    // Vérifier que la commande peut être annulée
    const currentStatus = order.status;
    if (currentStatus !== 'pending' && currentStatus !== 'accepted') {
      return res.status(400).json({ 
        message: `Cannot cancel order with status: ${currentStatus}` 
      });
    }

    // Mettre à jour le statut
    order.status = 'cancelled';
    order.cancelledAt = new Date();

    // Mettre à jour dans la DB
    try {
      await pool.query(
        'UPDATE orders SET status = $1, cancelled_at = NOW() WHERE id = $2',
        ['cancelled', orderId]
      );
    } catch (err) {
      console.warn('Warning: failed to persist cancellation to DB', err.message || err);
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

    return res.json({ success: true, message: 'Order cancelled successfully', order });
  } catch (error) {
    console.error('Error cancelOrder:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Upload proof (image/base64) - development helper
export const uploadDeliveryProof = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { proofBase64, proofType = 'image' } = req.body;

    if (!orderId || !proofBase64) return res.status(400).json({ message: 'orderId and proofBase64 are required' });

    const order = activeOrders.get(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const driverId = req.user?.id;
    if (!driverId || (order.driverId && order.driverId !== driverId)) return res.status(403).json({ message: 'Driver not assigned to this order' });

    // Write base64 to /tmp as a file for dev purposes
    const buffer = Buffer.from(proofBase64, 'base64');
    const proofsDir = path.join(process.cwd(), 'tmp_proofs');
    if (!fs.existsSync(proofsDir)) fs.mkdirSync(proofsDir);
    const filename = `${orderId}_${Date.now()}.${proofType === 'image' ? 'jpg' : 'bin'}`;
    const filepath = path.join(proofsDir, filename);
    fs.writeFileSync(filepath, buffer);

    // Attach proof metadata to order in-memory (dev)
    order.proof = { path: filepath, uploadedAt: new Date(), driverId };

    // Notify user via socket
    const io = req.app.get('io');
    const userSocketId = connectedUsers.get(order.user.id);
    if (userSocketId) {
      io.to(userSocketId).emit('order:proof:uploaded', { orderId, proof: { uploadedAt: order.proof.uploadedAt } });
    }

    return res.json({ success: true, filepath });
  } catch (err) {
    console.error('Error uploadDeliveryProof:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * 📊 Récupérer les statistiques d'un client
 * Retourne : nombre de commandes complétées, points de fidélité, économies totales
 */
export const getUserStatistics = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId est requis'
      });
    }

    // Vérifier que la connexion DB est configurée
    if (!process.env.DATABASE_URL) {
      logger.warn('⚠️ DATABASE_URL non configuré pour getUserStatistics');
      return res.json({
        success: true,
        data: {
          completedOrders: 0,
          loyaltyPoints: 0,
          totalSaved: 0
        }
      });
    }

    try {
      // Compter les commandes complétées (status = 'completed')
      const completedOrdersResult = await pool.query(
        `SELECT COUNT(*) as count FROM orders 
         WHERE user_id = $1 AND status = 'completed'`,
        [userId]
      );
      const completedOrders = parseInt(completedOrdersResult.rows[0]?.count || 0);

      // Calculer les points de fidélité : 1 point par commande complétée
      // + bonus : 5 points supplémentaires toutes les 10 commandes
      const basePoints = completedOrders; // 1 point par commande
      const bonusPoints = Math.floor(completedOrders / 10) * 5; // 5 points bonus toutes les 10 commandes
      const loyaltyPoints = basePoints + bonusPoints;

      // Calculer les économies totales (pour l'instant = 0, à implémenter avec les codes promo)
      const totalSaved = 0;

      res.json({
        success: true,
        data: {
          completedOrders,
          loyaltyPoints,
          totalSaved
        }
      });
    } catch (queryError) {
      logger.error('❌ Erreur requête getUserStatistics:', queryError);
      // En cas d'erreur SQL, retourner un résultat vide plutôt que planter
      return res.json({
        success: true,
        data: {
          completedOrders: 0,
          loyaltyPoints: 0,
          totalSaved: 0
        }
      });
    }
  } catch (error) {
    logger.error('❌ Erreur getUserStatistics:', error);
    // Retourner un résultat vide en cas d'erreur pour éviter de crasher l'app
    return res.json({
      success: true,
      data: {
        completedOrders: 0,
        loyaltyPoints: 0,
        totalSaved: 0
      }
    });
  }
};
