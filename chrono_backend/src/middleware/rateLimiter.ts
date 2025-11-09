import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';

/**
 * Rate limiter pour l'authentification (5 tentatives / 15 minutes)
 */
export const authLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 tentatives max
  message: {
    success: false,
    message: 'Trop de tentatives de connexion, réessayez dans 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiter pour les OTP (3 OTP / minute)
 */
export const otpLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // 3 OTP par minute
  message: {
    success: false,
    message: 'Trop de demandes OTP, attendez 1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiter général pour l'API (100 requêtes / 15 minutes)
 */
export const apiLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requêtes max
  message: {
    success: false,
    message: 'Trop de requêtes, réessayez plus tard'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiter pour l'inscription (3 inscriptions / heure)
 */
export const registerLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 3, // 3 inscriptions max par heure
  message: {
    success: false,
    message: 'Trop de tentatives d\'inscription, réessayez dans 1 heure'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiter strict pour la création de commandes (10 / heure)
 */
export const orderLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 10, // 10 commandes max par heure
  message: {
    success: false,
    message: 'Trop de commandes créées, réessayez dans 1 heure'
  },
  standardHeaders: true,
  legacyHeaders: false
});

