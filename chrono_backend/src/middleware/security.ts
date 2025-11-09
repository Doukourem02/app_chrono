/**
 * Middleware de sécurité supplémentaires
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';

/**
 * Validation stricte des coordonnées GPS
 * Protection contre les valeurs invalides (NaN, Infinity, etc.)
 */
export function validateCoordinates(coords: { latitude: number; longitude: number }): boolean {
  if (!coords || typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') {
    return false;
  }
  
  // Vérifier les limites géographiques
  if (coords.latitude < -90 || coords.latitude > 90) {
    return false;
  }
  
  if (coords.longitude < -180 || coords.longitude > 180) {
    return false;
  }
  
  // Vérifier que ce n'est pas NaN ou Infinity
  if (!isFinite(coords.latitude) || !isFinite(coords.longitude)) {
    return false;
  }
  
  // Vérifier la précision (éviter les valeurs trop précises qui pourraient être suspectes)
  const latDecimalPlaces = (coords.latitude.toString().split('.')[1] || '').length;
  const lonDecimalPlaces = (coords.longitude.toString().split('.')[1] || '').length;
  
  // Limiter à 8 décimales maximum (précision GPS raisonnable)
  if (latDecimalPlaces > 8 || lonDecimalPlaces > 8) {
    return false;
  }
  
  return true;
}

/**
 * Middleware pour valider les coordonnées dans les requêtes
 */
export const validateCoordinatesMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const { pickup, dropoff } = req.body;
  
  if (pickup?.coordinates && !validateCoordinates(pickup.coordinates)) {
    res.status(400).json({
      success: false,
      message: 'Coordonnées de prise en charge invalides'
    });
    return;
  }
  
  if (dropoff?.coordinates && !validateCoordinates(dropoff.coordinates)) {
    res.status(400).json({
      success: false,
      message: 'Coordonnées de livraison invalides'
    });
    return;
  }
  
  next();
};

/**
 * Sanitize les entrées utilisateur pour éviter les injections
 */
export function sanitizeString(input: string | undefined | null): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  // Supprimer les caractères dangereux
  return input
    .trim()
    .replace(/[<>]/g, '') // Supprimer < et >
    .replace(/javascript:/gi, '') // Supprimer javascript:
    .replace(/on\w+=/gi, ''); // Supprimer les handlers d'événements
}

/**
 * Valider et sanitizer les adresses
 */
export function sanitizeAddress(address: string | undefined | null): string {
  if (!address || typeof address !== 'string') {
    return '';
  }
  
  // Garder les caractères alphanumériques, espaces, tirets, apostrophes, virgules
  return address
    .trim()
    .replace(/[<>]/g, '') // Supprimer < et >
    .substring(0, 200); // Limiter à 200 caractères
}

/**
 * Middleware pour logger les tentatives suspectes
 */
export const securityLogger = (req: Request, res: Response, next: NextFunction): void => {
  // Logger les tentatives de connexion échouées
  if (req.path.includes('/auth') && req.method === 'POST') {
    // Ce sera loggé dans le controller après vérification
    // Ici on peut logger les headers suspects
    const userAgent = req.headers['user-agent'] || 'unknown';
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    
    // Détecter les patterns suspects
    if (userAgent.includes('bot') || userAgent.includes('crawler')) {
      logger.warn(`⚠️ Tentative suspecte détectée: ${req.path} depuis ${ip}`, {
        userAgent,
        path: req.path,
        method: req.method
      });
    }
  }
  
  next();
};

/**
 * Middleware pour limiter la taille des chaînes de caractères
 */
export const limitStringLength = (maxLength: number = 1000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Cette fonction sera appliquée dans les validateurs Joi
    // Pour l'instant, on passe simplement
    next();
  };
};

