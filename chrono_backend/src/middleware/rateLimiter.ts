import { Request } from 'express';
import rateLimit, { RateLimitRequestHandler, ipKeyGenerator } from 'express-rate-limit';

const skipInTest = () => process.env.NODE_ENV === 'test';

/** Clé par téléphone/e-mail visé plutôt que par IP seule : évite le contournement
 * du rate-limit OTP par rotation d'IP (cf. audit_krono.md #8). */
const otpKeyGenerator = (req: Request): string => {
  const phone = (req.body?.phone as string)?.replace(/\D/g, '');
  if (phone && phone.length >= 6) return `phone:${phone}`;
  const email = (req.body?.email as string)?.trim().toLowerCase();
  if (email) return `email:${email}`;
  return ipKeyGenerator(req.ip || 'unknown');
};

export const authLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skip: skipInTest,
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
  skip: skipInTest,
  keyGenerator: otpKeyGenerator,
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
  skip: skipInTest,
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
  skip: skipInTest,
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
  skip: skipInTest,
  message: {
    success: false,
    message: 'Trop de commandes créées, réessayez dans 1 heure'
  },
  standardHeaders: true,
  legacyHeaders: false
});
