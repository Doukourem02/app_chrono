import { Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import logger from '../utils/logger.js';
import type { JWTPayload } from '../types/index.js';
import { computeDynamicDeliveryPrice } from '../services/dynamicPricing.js';

type AuthenticatedRequest = {
  body: {
    userId?: string;
    pickup?: unknown;
    dropoff?: unknown;
    method?: string;
    priceCfa?: number;
    distanceKm?: number;
    speedOptionId?: string;
    routeDurationSeconds?: number;
    routeDurationTypicalSeconds?: number;
  };
  user?: JWTPayload;
};

type Coords = { latitude?: number; longitude?: number };

function readCoords(loc: unknown): { lat?: number; lon?: number } {
  if (!loc || typeof loc !== 'object') return {};
  const c = (loc as { coordinates?: Coords }).coordinates;
  if (!c || typeof c !== 'object') return {};
  const lat = c.latitude;
  const lon = c.longitude;
  return {
    lat: typeof lat === 'number' && Number.isFinite(lat) ? lat : undefined,
    lon: typeof lon === 'number' && Number.isFinite(lon) ? lon : undefined,
  };
}

/**
 * Création d’enregistrement commande (RPC Supabase) côté serveur avec la service role.
 * L’app client n’envoie pas de JWT Supabase : son token est celui de l’API (auth-simple).
 * Les appels directs supabase.rpc() depuis le mobile provoquent des 401 si la RPC exige un rôle authentifié.
 * Prix : recalcul tarif dynamique (niveau C) — le montant client sert seulement de contrôle.
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

    const {
      userId,
      pickup,
      dropoff,
      method,
      priceCfa,
      distanceKm,
      speedOptionId,
      routeDurationSeconds,
      routeDurationTypicalSeconds,
    } = req.body;

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
    if (typeof distanceKm !== 'number' || !Number.isFinite(distanceKm) || distanceKm <= 0) {
      res.status(400).json({ success: false, message: 'distanceKm requis (nombre > 0)' });
      return;
    }

    const { lat: pickupLat, lon: pickupLng } = readCoords(pickup);

    const rd =
      routeDurationSeconds != null &&
      Number.isFinite(Number(routeDurationSeconds)) &&
      Number(routeDurationSeconds) > 0
        ? Number(routeDurationSeconds)
        : undefined;
    const rt =
      routeDurationTypicalSeconds != null &&
      Number.isFinite(Number(routeDurationTypicalSeconds)) &&
      Number(routeDurationTypicalSeconds) > 0
        ? Number(routeDurationTypicalSeconds)
        : undefined;

    const dynamic = await computeDynamicDeliveryPrice({
      distanceKm,
      method,
      speedOptionId: typeof speedOptionId === 'string' ? speedOptionId : undefined,
      pickupLatitude: pickupLat,
      pickupLongitude: pickupLng,
      routeDurationSeconds: rd,
      routeDurationTypicalSeconds: rt,
    });

    const serverPrice = dynamic.totalCfa;

    if (typeof priceCfa === 'number' && Number.isFinite(priceCfa)) {
      const diff = Math.abs(priceCfa - serverPrice);
      if (diff > 5) {
        logger.warn('[orders/record] Écart prix client/serveur', {
          client: priceCfa,
          server: serverPrice,
          distanceKm,
          method,
          labels: dynamic.labels,
        });
      }
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
      p_price: serverPrice,
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
      data: {
        orderId: data as string,
        priceCfa: serverPrice,
        distanceKm,
        dynamicPricing: {
          labels: dynamic.labels,
          contextFactorApplied: dynamic.contextFactorApplied,
        },
      },
    });
  } catch (e: unknown) {
    logger.error('createOrderRecord inattendu', e);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
    });
  }
};
