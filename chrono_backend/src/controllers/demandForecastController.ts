import { Request, Response } from 'express';
import { predictDemand, predictPeakHours, recommendZonesForDrivers } from '../services/demandForecastService.js';
import logger from '../utils/logger.js';

/**
 * GET /api/forecast/demand
 * Prédit la demande pour une zone
 */
export const getDemandForecast = async (req: Request, res: Response): Promise<void> => {
  try {
    const zone = req.query.zone as string;
    const hour = parseInt(req.query.hour as string) || new Date().getHours();
    const dayOfWeek = parseInt(req.query.dayOfWeek as string) || new Date().getDay();

    if (!zone) {
      res.status(400).json({ error: 'Zone requise' });
      return;
    }

    const forecast = await predictDemand(zone, hour, dayOfWeek);
    res.json(forecast);
  } catch (error: any) {
    logger.error('Error getting demand forecast:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

/**
 * GET /api/forecast/peaks
 * Prédit les pics de demande pour une zone
 */
export const getPeakHours = async (req: Request, res: Response): Promise<void> => {
  try {
    const zone = req.query.zone as string;

    if (!zone) {
      res.status(400).json({ error: 'Zone requise' });
      return;
    }

    const peaks = await predictPeakHours(zone);
    res.json({ peaks });
  } catch (error: any) {
    logger.error('Error getting peak hours:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

/**
 * GET /api/forecast/recommendations
 * Recommande des zones aux livreurs
 */
export const getZoneRecommendations = async (req: Request, res: Response): Promise<void> => {
  try {
    const recommendations = await recommendZonesForDrivers();
    res.json({ recommendations });
  } catch (error: any) {
    logger.error('Error getting recommendations:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

