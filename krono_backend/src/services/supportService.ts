/**
 * Service de support client
 * Chatbot FAQ et système de tickets
 */

import pool from '../config/db.js';
import logger from '../utils/logger.js';

export interface FAQEntry {
  question: string;
  answer: string;
  category: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Base de connaissances FAQ
 */
const FAQ_DATABASE: FAQEntry[] = [
  {
    question: 'Comment suivre ma commande ?',
    answer: 'Vous pouvez suivre votre commande en temps réel dans l\'application. Le livreur apparaît sur la carte avec son positionnement GPS.',
    category: 'suivi',
  },
  {
    question: 'Combien de temps prend une livraison ?',
    answer: 'Le temps de livraison dépend de la distance et du trafic. En moyenne, une livraison prend entre 20 et 45 minutes.',
    category: 'delai',
  },
  {
    question: 'Comment annuler une commande ?',
    answer: 'Vous pouvez annuler une commande depuis l\'application tant qu\'elle n\'a pas été acceptée par un livreur.',
    category: 'annulation',
  },
  {
    question: 'Quels sont les moyens de paiement acceptés ?',
    answer: 'Nous acceptons le paiement en espèces, Orange Money, Wave et le paiement différé (sous conditions).',
    category: 'paiement',
  },
  {
    question: 'Que faire si ma commande est en retard ?',
    answer: 'Contactez le support via l\'application. Nous ferons notre maximum pour résoudre le problème rapidement.',
    category: 'probleme',
  },
];

/**
 * Recherche dans la FAQ
 */
export function searchFAQ(query: string): FAQEntry[] {
  const lowerQuery = query.toLowerCase();
  
  return FAQ_DATABASE.filter(entry => 
    entry.question.toLowerCase().includes(lowerQuery) ||
    entry.answer.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Crée un ticket de support
 */
export async function createSupportTicket(
  userId: string,
  subject: string,
  message: string,
  category: string = 'general'
): Promise<SupportTicket> {
  try {
    const result = await pool.query(
      `INSERT INTO support_tickets (user_id, subject, message, category, status)
       VALUES ($1, $2, $3, $4, 'open')
       RETURNING id, user_id, subject, message, status, category, created_at, updated_at`,
      [userId, subject, message, category]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      subject: row.subject,
      message: row.message,
      status: row.status,
      category: row.category,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  } catch (error: any) {
    logger.error('Error creating support ticket:', error);
    throw error;
  }
}

/**
 * Récupère les tickets d'un utilisateur
 */
export async function getUserTickets(userId: string): Promise<SupportTicket[]> {
  try {
    const result = await pool.query(
      `SELECT id, user_id, subject, message, status, category, created_at, updated_at
       FROM support_tickets
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      subject: row.subject,
      message: row.message,
      status: row.status,
      category: row.category,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  } catch (error: any) {
    logger.error('Error getting user tickets:', error);
    return [];
  }
}

