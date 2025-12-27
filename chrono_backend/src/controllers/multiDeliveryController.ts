import { Request, Response } from 'express';
import { optimizeRoute, groupOrdersByZone, calculateOptimalRouteForGroup } from '../services/multiDeliveryService.js';
import pool from '../config/db.js';
import logger from '../utils/logger.js';

/**
 * POST /api/multi-delivery/optimize
 * Optimise un itinéraire pour plusieurs commandes
 */
export const optimizeDeliveryRoute = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderIds, driverPosition } = req.body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      res.status(400).json({ error: 'Liste de commandes requise' });
      return;
    }

    if (!driverPosition || !driverPosition.latitude || !driverPosition.longitude) {
      res.status(400).json({ error: 'Position du livreur requise' });
      return;
    }

    // Récupérer les commandes
    const result = await pool.query(
      `SELECT id, 
        (pickup->>'latitude')::float as pickup_lat,
        (pickup->>'longitude')::float as pickup_lng,
        (dropoff->>'latitude')::float as dropoff_lat,
        (dropoff->>'longitude')::float as dropoff_lng
       FROM orders
       WHERE id = ANY($1::uuid[])`,
      [orderIds]
    );

    const orders = result.rows.map(row => ({
      id: row.id,
      pickup: { latitude: row.pickup_lat, longitude: row.pickup_lng },
      dropoff: { latitude: row.dropoff_lat, longitude: row.dropoff_lng },
    }));

    const optimized = calculateOptimalRouteForGroup(orders, driverPosition);

    res.json(optimized);
  } catch (error: any) {
    logger.error('Error optimizing route:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

/**
 * GET /api/multi-delivery/zones
 * Groupe les commandes par zone
 */
export const getZonesWithOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const driverId = (req as any).user?.id;
    if (!driverId) {
      res.status(401).json({ error: 'Non autorisé' });
      return;
    }

    // Récupérer les commandes disponibles
    const result = await pool.query(
      `SELECT id, 
        (pickup->>'latitude')::float as pickup_lat,
        (pickup->>'longitude')::float as pickup_lng,
        (dropoff->>'latitude')::float as dropoff_lat,
        (dropoff->>'longitude')::float as dropoff_lng,
        pickup_address
       FROM orders
       WHERE status = 'pending' OR status = 'accepted'
       ORDER BY created_at DESC
       LIMIT 50`,
      []
    );

    const orders = result.rows.map(row => ({
      id: row.id,
      pickup: { latitude: row.pickup_lat, longitude: row.pickup_lng },
      dropoff: { latitude: row.dropoff_lat, longitude: row.dropoff_lng },
      address: row.pickup_address,
    }));

    const groups = groupOrdersByZone(orders, 5); // 5km de rayon

    res.json({ zones: groups });
  } catch (error: any) {
    logger.error('Error getting zones:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

