import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';
import { requestContext } from '../utils/requestContext.js';

const HEADER = 'x-request-id';

function readIncomingRequestId(req: Request): string | undefined {
  const raw = req.headers[HEADER];
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (Array.isArray(raw) && raw[0]?.trim()) return raw[0].trim();
  return undefined;
}

/**
 * Génère ou reprend X-Request-Id, l’expose en réponse, et peuple le contexte async (logs Winston + Sentry).
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = readIncomingRequestId(req) ?? randomUUID();
  res.setHeader('X-Request-Id', requestId);

  requestContext.run({ requestId }, () => {
    if (process.env.SENTRY_DSN) {
      Sentry.getCurrentScope().setTag('request_id', requestId);
    }
    next();
  });
}
