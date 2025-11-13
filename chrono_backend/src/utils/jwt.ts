import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import logger from './logger.js';
import { JWTPayload, User } from '../types/index.js';


const JWT_SECRET_ENV = process.env.JWT_SECRET;

if (!JWT_SECRET_ENV) {
  throw new Error(
    'JWT_SECRET must be defined in environment variables. This is a critical security requirement.'
  );
}

if (JWT_SECRET_ENV.length < 32) {
  throw new Error(
    'JWT_SECRET must be at least 32 characters long for security. Current length: ' +
      JWT_SECRET_ENV.length
  );
}


const JWT_SECRET: string = JWT_SECRET_ENV;
const JWT_EXPIRES_IN = '5m'; // 5 minutes
const REFRESH_EXPIRES_IN = '7d'; // 7 jours


export function generateTokens(
  user: User | { id: string; role?: string }
): { accessToken: string; refreshToken: string } {
  if (!user || !user.id) {
    throw new Error('User data is required to generate tokens');
  }

  const accessToken = jwt.sign(
    {
      id: user.id,
      role: (user as User).role || 'client',
      type: 'access',
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  const refreshToken = jwt.sign(
    {
      id: user.id,
      type: 'refresh',
    },
    JWT_SECRET,
    { expiresIn: REFRESH_EXPIRES_IN }
  );

  return { accessToken, refreshToken };
}


export function verifyAccessToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as unknown as JWTPayload;

    // Vérifier que c'est bien un token d'accès
    if (decoded.type && decoded.type !== 'access') {
      throw new Error("Ce n'est pas un token d'accès valide");
    }

    return decoded;
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token expiré');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Token invalide');
    }
    throw error;
  }
}


export function verifyToken(token: string): JWTPayload {
  return verifyAccessToken(token);
}


export async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string }> {
  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET) as unknown as JWTPayload;

    if (decoded.type !== 'refresh') {
      throw new Error("Token invalide: ce n'est pas un refresh token");
    }

    const result = await pool.query<{ id: string; role: string }>(
      'SELECT id, role FROM users WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      throw new Error('Utilisateur non trouvé');
    }

    const user = result.rows[0];

    const accessToken = jwt.sign(
      { id: user.id, role: user.role, type: 'access' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return { accessToken };
  } catch (error: any) {
    throw new Error(`Erreur lors du rafraîchissement du token: ${error.message}`);
  }
}

export default {
  generateTokens,
  verifyToken,
  verifyAccessToken,
  refreshAccessToken,
};
