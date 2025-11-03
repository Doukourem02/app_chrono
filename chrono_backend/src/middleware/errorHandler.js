import logger from '../utils/logger.js';

/**
 * Middleware global de gestion d'erreurs
 */
export const errorHandler = (err, req, res, next) => {
  logger.error('❌ Error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
  
  // Erreur CORS
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: 'Origine non autorisée'
    });
  }
  
  // Erreur de validation (Joi)
  if (err.name === 'ValidationError' || err.isJoi) {
    return res.status(400).json({
      success: false,
      message: 'Erreur de validation',
      errors: err.details ? err.details.map(d => d.message) : [err.message]
    });
  }
  
  // Erreur JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Token invalide'
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expiré'
    });
  }
  
  // Erreur par défaut
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Erreur serveur' 
      : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

export default errorHandler;

