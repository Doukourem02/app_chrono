import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';

export const verifyJWT = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const auth = req.headers.authorization || req.headers.Authorization;

  if (!auth) {
    res.status(401).json({
      success: false,
      message: 'Non autorisé - En-tête Authorization manquant',
    });
    return;
  }

  const parts = (auth as string).split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    res.status(401).json({
      success: false,
      message: 'Format d\'autorisation invalide. Attendu: Bearer <token>',
    });
    return;
  }

  const token = parts[1];

  try {
    const decoded = verifyAccessToken(token);
    (req as any).user = decoded;
    next();
  } catch (err: any) {
    if (err.message === 'Token expiré') {
      res.status(401).json({
        success: false,
        message: 'Token expiré. Utilisez /refresh-token pour obtenir un nouveau token',
        code: 'TOKEN_EXPIRED',
      });
      return;
    }

    res.status(401).json({
      success: false,
      message: err.message || 'Token invalide',
      code: 'INVALID_TOKEN',
    });
  }
};

export default verifyJWT;
