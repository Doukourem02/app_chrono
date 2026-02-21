/**
 * Routes proxy Mapbox - Geocoding, Directions, Search Box
 * Le token serveur reste côté backend, jamais exposé au client
 */
import { Router, Request, Response } from 'express';
import {
  geocodeForward,
  reverseGeocode,
  getDirections,
  searchSuggest,
  searchRetrieve,
} from '../utils/mapboxService.js';

const router = Router();

/**
 * GET /api/mapbox/geocode?address=...
 * Forward geocoding : adresse → coordonnées
 */
router.get('/geocode', async (req: Request, res: Response): Promise<void> => {
  const address = req.query.address as string;
  if (!address?.trim()) {
    res.status(400).json({ error: 'Paramètre address requis' });
    return;
  }

  const result = await geocodeForward(address, {
    country: (req.query.country as string) || 'ci',
    limit: Math.min(parseInt(String(req.query.limit || '1'), 10), 10),
  });

  if (!result) {
    res.status(404).json({ error: 'Géocodage échoué' });
    return;
  }

  res.json(result);
});

/**
 * GET /api/mapbox/reverse?latitude=...&longitude=...
 * Reverse geocoding : coordonnées → adresse
 */
router.get('/reverse', async (req: Request, res: Response): Promise<void> => {
  const lat = parseFloat(String(req.query.latitude));
  const lng = parseFloat(String(req.query.longitude));

  if (isNaN(lat) || isNaN(lng)) {
    res.status(400).json({ error: 'Paramètres latitude et longitude requis (numériques)' });
    return;
  }

  const result = await reverseGeocode(lat, lng);

  if (!result) {
    res.status(404).json({ error: 'Reverse géocodage échoué' });
    return;
  }

  res.json(result);
});

/**
 * GET /api/mapbox/directions?origin=lat,lng&destination=lat,lng
 * ou origin_lat, origin_lng, dest_lat, dest_lng
 */
router.get('/directions', async (req: Request, res: Response): Promise<void> => {
  let origin: { lat: number; lng: number };
  let destination: { lat: number; lng: number };

  const originStr = req.query.origin as string;
  const destStr = req.query.destination as string;

  if (originStr && destStr) {
    const [oLat, oLng] = originStr.split(',').map(Number);
    const [dLat, dLng] = destStr.split(',').map(Number);
    if (isNaN(oLat) || isNaN(oLng) || isNaN(dLat) || isNaN(dLng)) {
      res.status(400).json({ error: 'Format origin/destination: lat,lng' });
      return;
    }
    origin = { lat: oLat, lng: oLng };
    destination = { lat: dLat, lng: dLng };
  } else {
    const oLat = parseFloat(String(req.query.origin_lat));
    const oLng = parseFloat(String(req.query.origin_lng));
    const dLat = parseFloat(String(req.query.dest_lat));
    const dLng = parseFloat(String(req.query.dest_lng));
    if (isNaN(oLat) || isNaN(oLng) || isNaN(dLat) || isNaN(dLng)) {
      res.status(400).json({
        error: 'Paramètres requis: origin (lat,lng) et destination (lat,lng), ou origin_lat, origin_lng, dest_lat, dest_lng',
      });
      return;
    }
    origin = { lat: oLat, lng: oLng };
    destination = { lat: dLat, lng: dLng };
  }

  const result = await getDirections(origin, destination);

  if (!result) {
    res.status(404).json({ error: 'Calcul d\'itinéraire échoué' });
    return;
  }

  res.json(result);
});

/**
 * GET /api/mapbox/search/suggest?q=...
 * Search Box - suggestions (autocomplete)
 */
router.get('/search/suggest', async (req: Request, res: Response): Promise<void> => {
  const q = (req.query.q as string)?.trim();
  if (!q || q.length < 2) {
    res.status(400).json({ error: 'Paramètre q requis (min 2 caractères)' });
    return;
  }

  const suggestions = await searchSuggest(q, {
    country: (req.query.country as string) || 'ci',
    proximity: req.query.proximity as string,
    limit: Math.min(parseInt(String(req.query.limit || '10'), 10), 20),
    sessionToken: req.query.session_token as string,
  });

  res.json({ suggestions });
});

/**
 * GET /api/mapbox/search/retrieve/:mapboxId
 * Search Box - récupérer les coordonnées d'une suggestion
 */
router.get('/search/retrieve/:mapboxId', async (req: Request, res: Response): Promise<void> => {
  const mapboxId = req.params.mapboxId;
  if (!mapboxId) {
    res.status(400).json({ error: 'mapboxId requis' });
    return;
  }

  const result = await searchRetrieve(mapboxId, {
    sessionToken: req.query.session_token as string,
  });

  if (!result) {
    res.status(404).json({ error: 'Récupération échouée' });
    return;
  }

  res.json(result);
});

export default router;
