import jwt, { type SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import pool from '../config/db.js';
import { supabaseAdmin } from '../config/supabase.js';
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
const JWT_EXPIRES_IN = '15m';
const REFRESH_EXPIRES_IN = (process.env.JWT_REFRESH_EXPIRES_IN || '90d') as SignOptions['expiresIn'];
const REFRESH_EXPIRES_MS = 90 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function generateTokens(
  user: User | { id: string; role?: string }
): Promise<{ accessToken: string; refreshToken: string }> {
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
    { id: user.id, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: REFRESH_EXPIRES_IN }
  );

  // Stocker le hash en base pour permettre la révocation
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_MS);

  try {
    const client = supabaseAdmin;
    if (client) {
      await client.from('refresh_tokens').insert({
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
      });
    }
  } catch (err) {
    logger.error('[jwt] Erreur stockage refresh token:', err);
  }

  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as unknown as JWTPayload;

    if (decoded.type && decoded.type !== 'access') {
      throw new Error("Ce n'est pas un token d'accès valide");
    }

    return decoded;
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') throw new Error('Token expiré');
    if (error.name === 'JsonWebTokenError') throw new Error('Token invalide');
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

    // Vérifier que le token existe en base (non révoqué)
    const tokenHash = hashToken(refreshToken);
    const client = supabaseAdmin;

    if (client) {
      const { data, error } = await client
        .from('refresh_tokens')
        .select('id, expires_at')
        .eq('token_hash', tokenHash)
        .single();

      if (error || !data) {
        throw new Error('Refresh token révoqué ou invalide');
      }

      if (new Date(data.expires_at) < new Date()) {
        await client.from('refresh_tokens').delete().eq('token_hash', tokenHash);
        throw new Error('Refresh token expiré');
      }

      // Rotation : supprimer l'ancien token (one-time use)
      await client.from('refresh_tokens').delete().eq('token_hash', tokenHash);
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

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  const tokenHash = hashToken(refreshToken);
  const client = supabaseAdmin;
  if (client) {
    await client.from('refresh_tokens').delete().eq('token_hash', tokenHash);
  }
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  const client = supabaseAdmin;
  if (client) {
    await client.from('refresh_tokens').delete().eq('user_id', userId);
  }
}

export default {
  generateTokens,
  verifyToken,
  verifyAccessToken,
  refreshAccessToken,
  revokeRefreshToken,
  revokeAllUserTokens,
};
