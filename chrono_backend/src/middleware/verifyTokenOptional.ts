import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';

/**
 * 🔒 Middleware de vérification JWT optionnel
 * Vérifie le token d'accès s'il est présent, mais ne bloque pas la requête s'il est absent
 */
export const verifyJWTOptional = (req: Request, res: Response, next: NextFunction): void => {
  const auth = req.headers.authorization || req.headers.Authorization;
  
  // Si pas de token, continuer sans authentification
  if (!auth) {
    next();
    return;
  }

  const parts = (auth as string).split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    next(); // Format invalide mais on continue quand même
    return;
  }

  const token = parts[1];
  try {
    const decoded = verifyAccessToken(token);
    // Attacher les infos décodées à la requête pour les handlers suivants
    (req as any).user = decoded;
    next();
  } catch (err) {
    // En cas d'erreur, continuer quand même (authentification optionnelle)
    // L'application pourra vérifier req.user dans le contrôleur
    next();
  }
};

export default verifyJWTOptional;

