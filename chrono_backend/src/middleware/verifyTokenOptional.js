import { verifyAccessToken } from '../utils/jwt.js';

/**
 * 🔒 Middleware de vérification JWT optionnel
 * Vérifie le token d'accès s'il est présent, mais ne bloque pas la requête s'il est absent
 */
export const verifyJWTOptional = (req, res, next) => {
  const auth = req.headers.authorization || req.headers.Authorization;
  
  // Si pas de token, continuer sans authentification
  if (!auth) {
    return next();
  }

  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return next(); // Format invalide mais on continue quand même
  }

  const token = parts[1];
  try {
    const decoded = verifyAccessToken(token);
    // Attacher les infos décodées à la requête pour les handlers suivants
    req.user = decoded;
    return next();
  } catch (err) {
    // En cas d'erreur, continuer quand même (authentification optionnelle)
    // L'application pourra vérifier req.user dans le contrôleur
    return next();
  }
};

export default verifyJWTOptional;

