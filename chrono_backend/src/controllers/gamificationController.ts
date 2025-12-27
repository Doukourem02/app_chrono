import { Request, Response } from 'express';
import { checkAndUnlockBadges, getLeaderboard, calculateDriverScore } from '../services/gamificationService.js';
import pool from '../config/db.js';
import logger from '../utils/logger.js';

/**
 * GET /api/gamification/badges/:driverId
 * Récupère les badges d'un livreur
 */
export const getDriverBadges = async (req: Request, res: Response): Promise<void> => {
  try {
    const { driverId } = req.params;

    const result = await pool.query(
      `SELECT badge_id, unlocked_at
       FROM driver_badges
       WHERE driver_id = $1
       ORDER BY unlocked_at DESC`,
      [driverId]
    );

    res.json({ badges: result.rows });
  } catch (error: any) {
    logger.error('Error getting driver badges:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

/**
 * POST /api/gamification/badges/:driverId/check
 * Vérifie et débloque les nouveaux badges
 */
export const checkBadges = async (req: Request, res: Response): Promise<void> => {
  try {
    const { driverId } = req.params;

    const unlockedBadges = await checkAndUnlockBadges(driverId);

    res.json({ 
      unlocked: unlockedBadges,
      count: unlockedBadges.length 
    });
  } catch (error: any) {
    logger.error('Error checking badges:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

/**
 * GET /api/gamification/leaderboard
 * Récupère le classement des livreurs
 */
export const getLeaderboardRanking = async (req: Request, res: Response): Promise<void> => {
  try {
    const period = (req.query.period as 'week' | 'month' | 'all') || 'week';
    const zone = req.query.zone as string | undefined;

    const leaderboard = await getLeaderboard(period, zone);

    res.json({ leaderboard });
  } catch (error: any) {
    logger.error('Error getting leaderboard:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

/**
 * GET /api/gamification/score/:driverId
 * Récupère le score d'un livreur
 */
export const getDriverScore = async (req: Request, res: Response): Promise<void> => {
  try {
    const { driverId } = req.params;

    const score = await calculateDriverScore(driverId);

    res.json({ score });
  } catch (error: any) {
    logger.error('Error getting driver score:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

