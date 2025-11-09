import { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';
import logger from '../utils/logger.js';
import { AppError } from '../types/index.js';
import { sendErrorAlert, sendCriticalAlert } from '../utils/slackNotifier.js';

/**
 * Middleware global de gestion d'erreurs
 */
export const errorHandler = (
  err: AppError | Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.error('❌ Error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // 🔍 SENTRY: Capturer les erreurs critiques (500+) uniquement
  let statusCode = (err as AppError).statusCode || (err as any).status || 500;
  if (process.env.SENTRY_DSN && statusCode >= 500) {
    Sentry.captureException(err, {
      tags: {
        path: req.path,
        method: req.method,
        statusCode,
      },
      extra: {
        body: req.body,
        query: req.query,
        params: req.params,
      },
    });
  }
  
  // 📢 SLACK: Envoyer des alertes pour les erreurs critiques
  if (statusCode >= 500) {
    // Erreur critique (500+) - alerte immédiate
    sendCriticalAlert(
      `Erreur serveur ${statusCode} sur ${req.method} ${req.path}`,
      {
        Message: err.message,
        Path: req.path,
        Method: req.method,
        StatusCode: statusCode.toString(),
        Timestamp: new Date().toISOString(),
        ...(err.stack && { Stack: err.stack.substring(0, 500) })
      }
    ).catch(() => {
      // Ignorer les erreurs d'envoi Slack pour éviter les boucles
    });
  } else if (statusCode >= 400) {
    // Erreur client (400-499) - alerte si importante
    if (statusCode === 401 || statusCode === 403) {
      sendErrorAlert(
        `Erreur d'authentification/autorisation sur ${req.method} ${req.path}`,
        err,
        {
          Path: req.path,
          Method: req.method,
          StatusCode: statusCode.toString()
        }
      ).catch(() => {
        // Ignorer les erreurs d'envoi Slack
      });
    }
  }
  
  // Erreur CORS
  if (err.message === 'Not allowed by CORS') {
    res.status(403).json({
      success: false,
      message: 'Origine non autorisée'
    });
    return;
  }
  
  // Erreur de validation (Joi)
  if (err.name === 'ValidationError' || (err as any).isJoi) {
    const joiError = err as any;
    res.status(400).json({
      success: false,
      message: 'Erreur de validation',
      errors: joiError.details ? joiError.details.map((d: any) => d.message) : [err.message]
    });
    return;
  }
  
  // Erreur JWT
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({
      success: false,
      message: 'Token invalide'
    });
    return;
  }
  
  if (err.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      message: 'Token expiré'
    });
    return;
  }
  
  // Erreur par défaut
  statusCode = (err as AppError).statusCode || (err as any).status || 500;
  res.status(statusCode).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Erreur serveur' 
      : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

export default errorHandler;

