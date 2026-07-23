import { Request, Response } from 'express';
import { searchFAQ, createSupportTicket, getUserTickets } from '../services/supportService.js';
import logger from '../utils/logger.js';

/**
 * GET /api/support/faq
 * Recherche dans la FAQ
 */
export const searchFAQEntries = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = req.query.q as string || '';

    if (!query) {
      res.json({ results: [] });
      return;
    }

    const results = searchFAQ(query);
    res.json({ results });
  } catch (error: any) {
    logger.error('Error searching FAQ:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

/**
 * POST /api/support/tickets
 * Crée un ticket de support
 */
export const createTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Non autorisé' });
      return;
    }

    const { subject, message, category } = req.body;

    if (!subject || !message) {
      res.status(400).json({ error: 'Sujet et message requis' });
      return;
    }

    const ticket = await createSupportTicket(userId, subject, message, category || 'general');
    res.json({ ticket });
  } catch (error: any) {
    logger.error('Error creating ticket:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

/**
 * GET /api/support/tickets
 * Récupère les tickets d'un utilisateur
 */
export const getTickets = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Non autorisé' });
      return;
    }

    const tickets = await getUserTickets(userId);
    res.json({ tickets });
  } catch (error: any) {
    logger.error('Error getting tickets:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

