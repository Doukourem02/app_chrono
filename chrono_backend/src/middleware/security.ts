import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';

export function validateCoordinates(coords: { latitude: number; longitude: number }): boolean {
  if (!coords || typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') {
    return false;
  }

  if (coords.latitude < -90 || coords.latitude > 90) {
    return false;
  }
  
  if (coords.longitude < -180 || coords.longitude > 180) {
    return false;
  }
  
  if (!isFinite(coords.latitude) || !isFinite(coords.longitude)) {
    return false;
  }
  
  const latDecimalPlaces = (coords.latitude.toString().split('.')[1] || '').length;
  const lonDecimalPlaces = (coords.longitude.toString().split('.')[1] || '').length;

  if (latDecimalPlaces > 8 || lonDecimalPlaces > 8) {
    return false;
  }
  
  return true;
}

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

export function sanitizeString(input: string | undefined | null): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '');
}

export function sanitizeAddress(address: string | undefined | null): string {
  if (!address || typeof address !== 'string') {
    return '';
  }

  return address
    .trim()
    .replace(/[<>]/g, '')
    .substring(0, 200);
}

export const securityLogger = (req: Request, res: Response, next: NextFunction): void => {
  if (req.path.includes('/auth') && req.method === 'POST') {
    const userAgent = req.headers['user-agent'] || 'unknown';
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    if (userAgent.includes('bot') || userAgent.includes('crawler')) {
      logger.warn(`Tentative suspecte détectée: ${req.path} depuis ${ip}`, {
        userAgent,
        path: req.path,
        method: req.method
      });
    }
  }
  
  next();
};

export const limitStringLength = (maxLength: number = 1000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    next();
  };
};
