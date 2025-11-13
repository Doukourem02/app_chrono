import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';

export const verifyJWTOptional = (req: Request, res: Response, next: NextFunction): void => {
  const auth = req.headers.authorization || req.headers.Authorization;

  if (!auth) {
    next();
    return;
  }

  const parts = (auth as string).split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    next();
    return;
  }

  const token = parts[1];
  try {
    const decoded = verifyAccessToken(token);
    (req as any).user = decoded;
    next();
  } catch (err) {
    next();
  }
};

export default verifyJWTOptional;
