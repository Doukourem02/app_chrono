import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';

export const authLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: 'Trop de tentatives de connexion, réessayez dans 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

export const otpLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: {
    success: false,
    message: 'Trop de demandes OTP, attendez 1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false
});

export const apiLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: 'Trop de requêtes, réessayez plus tard'
  },
  standardHeaders: true,
  legacyHeaders: false
});

export const registerLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: {
    success: false,
    message: 'Trop de tentatives d\'inscription, réessayez dans 1 heure'
  },
  standardHeaders: true,
  legacyHeaders: false
});

export const orderLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Trop de commandes créées, réessayez dans 1 heure'
  },
  standardHeaders: true,
  legacyHeaders: false
});
