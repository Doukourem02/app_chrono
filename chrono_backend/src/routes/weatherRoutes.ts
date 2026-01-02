import { Router } from 'express';
import { getWeatherData, calculateWeatherAdjustment, isDifficultWeather } from '../services/weatherService.js';
import { verifyJWT } from '../middleware/verifyToken.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * GET /api/weather/:latitude/:longitude
 * Récupère les données météo pour une position GPS
 */
router.get('/:latitude/:longitude', verifyJWT, async (req, res) => {
  try {
    const latitude = parseFloat(req.params.latitude);
    const longitude = parseFloat(req.params.longitude);
    const vehicleType = req.query.vehicleType as 'moto' | 'vehicule' | 'cargo' | null || null;

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ error: 'Coordonnées GPS invalides' });
    }

    const weather = await getWeatherData(latitude, longitude);
    
    if (!weather) {
      return res.status(404).json({ error: 'Données météo non disponibles' });
    }

    const adjustment = calculateWeatherAdjustment(weather, vehicleType);
    const isDifficult = isDifficultWeather(weather);

    return res.json({
      weather,
      adjustment,
      isDifficult,
    });
  } catch (error: any) {
    logger.error('Error fetching weather:', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;

