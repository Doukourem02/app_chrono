import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';

/**
 * Protection contre les attaques par force brute
 * Tracking des tentatives d'authentification échouées
 */

// Stockage en mémoire des tentatives (en production, utiliser Redis)
interface FailedAttemptData {
  attempts: number;
  firstAttempt: number;
  lastAttempt: number;
  lockedUntil?: number;
}

const failedAttempts = new Map<string, FailedAttemptData>();

// Configuration
const MAX_ATTEMPTS = 5; // Nombre maximum de tentatives
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_MS = 30 * 60 * 1000; // 30 minutes de verrouillage

/**
 * Nettoyer les tentatives expirées
 */
function cleanupExpiredAttempts(): void {
  const now = Date.now();
  for (const [key, data] of failedAttempts.entries()) {
    if (now - data.lastAttempt > WINDOW_MS) {
      failedAttempts.delete(key);
    }
  }
}

/**
 * Vérifier si une IP ou un email est bloqué
 */
export function isBlocked(identifier: string): boolean {
  cleanupExpiredAttempts();
  
  const data = failedAttempts.get(identifier);
  if (!data) {
    return false;
  }
  
  // Si verrouillé, vérifier si le verrouillage est expiré
  if (data.lockedUntil && Date.now() < data.lockedUntil) {
    return true;
  }
  
  // Si le verrouillage est expiré, réinitialiser
  if (data.lockedUntil && Date.now() >= data.lockedUntil) {
    failedAttempts.delete(identifier);
    return false;
  }
  
  // Si trop de tentatives dans la fenêtre, verrouiller
  if (data.attempts >= MAX_ATTEMPTS) {
    if (!data.lockedUntil) {
      data.lockedUntil = Date.now() + LOCKOUT_MS;
      logger.warn(`🔒 Verrouillage de ${identifier} pour ${LOCKOUT_MS / 1000 / 60} minutes`);
    }
    return true;
  }
  
  return false;
}

/**
 * Enregistrer une tentative échouée
 */
export function recordFailedAttempt(identifier: string): void {
  cleanupExpiredAttempts();
  
  const now = Date.now();
  const data = failedAttempts.get(identifier);
  
  if (!data) {
    failedAttempts.set(identifier, {
      attempts: 1,
      firstAttempt: now,
      lastAttempt: now
    });
  } else {
    // Si la fenêtre est expirée, réinitialiser
    if (now - data.firstAttempt > WINDOW_MS) {
      failedAttempts.set(identifier, {
        attempts: 1,
        firstAttempt: now,
        lastAttempt: now
      });
    } else {
      data.attempts++;
      data.lastAttempt = now;
    }
  }
  
  // Logger si proche de la limite
  const attempts = failedAttempts.get(identifier)?.attempts || 0;
  if (attempts >= MAX_ATTEMPTS - 1) {
    logger.warn(`⚠️ Tentative de force brute suspecte: ${identifier} (${attempts} tentatives)`);
  }
}

/**
 * Réinitialiser les tentatives après une connexion réussie
 */
export function resetAttempts(identifier: string): void {
  failedAttempts.delete(identifier);
}

/**
 * Middleware pour protéger les routes d'authentification
 */
export const bruteForceProtection = (req: Request, res: Response, next: NextFunction): void => {
  // Identifier l'utilisateur par IP ou email
  const identifier = (req.body?.email as string) || 
                     req.ip || 
                     (req.headers['x-forwarded-for'] as string) || 
                     'unknown';
  
  if (isBlocked(identifier)) {
    const data = failedAttempts.get(identifier);
    const remainingTime = data?.lockedUntil ? Math.ceil((data.lockedUntil - Date.now()) / 1000 / 60) : 0;
    
    logger.warn(`🚫 Tentative bloquée: ${identifier} (verrouillé pour ${remainingTime} minutes)`);
    
    res.status(429).json({
      success: false,
      message: `Trop de tentatives échouées. Réessayez dans ${remainingTime} minutes.`,
      code: 'TOO_MANY_ATTEMPTS'
    });
    return;
  }
  
  // Attacher la fonction pour enregistrer les échecs
  (req as any).recordFailedAttempt = () => recordFailedAttempt(identifier);
  (req as any).resetAttempts = () => resetAttempts(identifier);
  
  next();
};

