import { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';
import logger from '../utils/logger.js';
import { AppError } from '../types/index.js';
import { sendErrorAlert, sendCriticalAlert } from '../utils/slackNotifier.js';

/**
 * Interface pour les erreurs Joi
 */
interface JoiError extends Error {
  isJoi?: boolean;
  details?: Array<{
    message: string;
    path: (string | number)[];
    type: string;
  }>;
}

/**
 * Interface pour les erreurs avec status code
 */
interface ErrorWithStatus extends Error {
  status?: number;
  statusCode?: number;
  type?: string;
}

export const errorHandler = (
  err: AppError | Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.error('Error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  let statusCode = (err as AppError).statusCode || (err as ErrorWithStatus).status || 500;

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
  
  if (statusCode >= 500) {
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
  
  if (err.message === 'Not allowed by CORS') {
    res.status(403).json({
      success: false,
      message: 'Origine non autorisée'
    });
    return;
  }
  
  if (err.name === 'ValidationError' || (err as JoiError).isJoi) {
    const joiError = err as JoiError;
    res.status(400).json({
      success: false,
      message: 'Erreur de validation',
      errors: joiError.details ? joiError.details.map((d) => d.message) : [err.message]
    });
    return;
  }
  
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

  // body-parser / express.json : JSON invalide — sinon en prod le client ne voit que « Erreur serveur » + 400
  const errType = (err as ErrorWithStatus).type;
  if (
    err.name === 'SyntaxError' ||
    errType === 'entity.parse.failed' ||
    errType === 'charset.unsupported'
  ) {
    res.status(400).json({
      success: false,
      message:
        errType === 'charset.unsupported'
          ? 'Charset du corps de requête non supporté (utilisez UTF-8)'
          : 'Corps JSON invalide ou mal formé',
    });
    return;
  }

  statusCode = (err as AppError).statusCode || (err as ErrorWithStatus).status || 500;
  res.status(statusCode).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Erreur serveur' : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

export default errorHandler;
