import { Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import logger from '../utils/logger.js';
import type { JWTPayload } from '../types/index.js';

type AuthenticatedRequest = {
  body: {
    userId?: string;
    pickup?: unknown;
    dropoff?: unknown;
    method?: string;
    priceCfa?: number;
    distanceKm?: number;
  };
  user?: JWTPayload;
};

/**
 * Création d’enregistrement commande (RPC Supabase) côté serveur avec la service role.
 * L’app client n’envoie pas de JWT Supabase : son token est celui de l’API (auth-simple).
 * Les appels directs supabase.rpc() depuis le mobile provoquent des 401 si la RPC exige un rôle authentifié.
 */
export const createOrderRecord = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const authUser = req.user;
    if (!authUser?.id) {
      res.status(401).json({ success: false, message: 'Non authentifié' });
      return;
    }

    const { userId, pickup, dropoff, method, priceCfa, distanceKm } = req.body;

    if (!userId || typeof userId !== 'string') {
      res.status(400).json({ success: false, message: 'userId requis' });
      return;
    }
    if (userId !== authUser.id) {
      res.status(403).json({ success: false, message: 'Accès refusé' });
      return;
    }
    if (pickup == null || dropoff == null) {
      res.status(400).json({ success: false, message: 'pickup et dropoff requis' });
      return;
    }
    if (!method || typeof method !== 'string') {
      res.status(400).json({ success: false, message: 'method requis' });
      return;
    }
    if (typeof priceCfa !== 'number' || typeof distanceKm !== 'number') {
      res.status(400).json({ success: false, message: 'priceCfa et distanceKm requis' });
      return;
    }

    const client = supabaseAdmin ?? supabase;
    if (!supabaseAdmin) {
      logger.warn(
        'createOrderRecord: SUPABASE_SERVICE_ROLE_KEY absent — utilisation du client anon ; la RPC peut échouer (RLS).'
      );
    }

    const { data, error } = await client.rpc('fn_create_order', {
      p_user_id: userId,
      p_pickup: pickup,
      p_dropoff: dropoff,
      p_method: method,
      p_price: priceCfa,
      p_distance: distanceKm,
    });

    if (error) {
      logger.warn('fn_create_order (serveur)', {
        message: error.message,
        code: error.code,
        details: error.details,
      });
      res.status(400).json({
        success: false,
        message: error.message || 'Erreur création commande',
        code: error.code,
      });
      return;
    }

    res.json({
      success: true,
      data: { orderId: data as string },
    });
  } catch (e: unknown) {
    logger.error('createOrderRecord inattendu', e);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
    });
  }
};
