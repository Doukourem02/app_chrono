import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import logger from './logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me-in-production';
const JWT_EXPIRES_IN = '15m'; // 15 minutes
const REFRESH_EXPIRES_IN = '7d'; // 7 jours

// Vérifier que JWT_SECRET est défini (en production)
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET must be set in production environment');
}

if (!process.env.JWT_SECRET && process.env.NODE_ENV !== 'production') {
  logger.warn('⚠️ JWT_SECRET non défini, utilisation d\'un secret par défaut (INSÉCURISÉ - utiliser uniquement en développement)');
}

/**
 * Génère un token d'accès et un refresh token
 */
export function generateTokens(user) {
  if (!user || !user.id) {
    throw new Error('User data is required to generate tokens');
  }
  
  const accessToken = jwt.sign(
    { id: user.id, role: user.role || 'client', type: 'access' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
  
  const refreshToken = jwt.sign(
    { id: user.id, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: REFRESH_EXPIRES_IN }
  );
  
  return { accessToken, refreshToken };
}

/**
 * Vérifie un token d'accès et retourne le payload décodé
 */
export function verifyAccessToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Vérifier que c'est bien un token d'accès
    if (decoded.type && decoded.type !== 'access') {
      throw new Error('Ce n\'est pas un token d\'accès valide');
    }
    
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token expiré');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Token invalide');
    }
    throw error;
  }
}

/**
 * Vérifie un token (générique - pour compatibilité)
 */
export function verifyToken(token) {
  return verifyAccessToken(token);
}

/**
 * Rafraîchit un token d'accès à partir d'un refresh token
 */
export async function refreshAccessToken(refreshToken) {
  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    
    if (decoded.type !== 'refresh') {
      throw new Error('Token invalide: ce n\'est pas un refresh token');
    }
    
    // Vérifier que l'utilisateur existe toujours
    const result = await pool.query('SELECT id, role FROM users WHERE id = $1', [decoded.id]);
    
    if (result.rows.length === 0) {
      throw new Error('Utilisateur non trouvé');
    }
    
    const user = result.rows[0];
    
    // Générer un nouveau token d'accès
    const accessToken = jwt.sign(
      { id: user.id, role: user.role, type: 'access' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    
    return { accessToken };
  } catch (error) {
    throw new Error(`Erreur lors du rafraîchissement du token: ${error.message}`);
  }
}

export default {
  generateTokens,
  verifyToken,
  verifyAccessToken,
  refreshAccessToken
};
