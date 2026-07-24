import winston from 'winston';
import path from 'path';
import { Logtail } from '@logtail/node';
import { LogtailTransport } from '@logtail/winston';
import { requestContext } from './requestContext.js';

// Ancré sur process.cwd() plutôt que sur __dirname/import.meta.url : une fois le code
// bundlé (esbuild), tous les modules partagent le chemin du seul fichier de sortie, ce qui
// fausserait un calcul relatif basé sur la profondeur d'origine de ce fichier.
const logsDir = path.join(process.cwd(), 'logs');

const requestIdFormat = winston.format((info) => {
  const requestId = requestContext.getStore()?.requestId;
  if (requestId) {
    info.request_id = requestId;
  }
  return info;
});

const betterStackToken =
  process.env.BETTER_STACK_SOURCE_TOKEN || process.env.LOGTAIL_SOURCE_TOKEN;

const logger = winston.createLogger({
  level:
    process.env.LOG_LEVEL ||
    (process.env.NODE_ENV === 'production' ? 'info' : 'info'),
  format: winston.format.combine(
    requestIdFormat(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'chrono-backend' },
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
    }),
  ],
});

if (process.env.NODE_ENV === 'production' && betterStackToken) {
  const logtail = new Logtail(betterStackToken);
  logger.add(new LogtailTransport(logtail));
}

// En prod (Render, etc.) seul stdout est visible dans l’UI « Logs » — sans Console, les
// messages Winston (Redis, Socket.IO, pool PG…) n’y apparaissent pas.
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.Console());
} else {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...metadata }) => {
          let msg = `${timestamp} [${level}]: ${message}`;
          if (Object.keys(metadata).length > 0) {
            msg += ` ${JSON.stringify(metadata)}`;
          }
          return msg;
        })
      ),
    })
  );
}

interface LoggerWithContext extends winston.Logger {
  withContext: (context: string) => {
    info: (message: string, ...args: any[]) => void;
    error: (message: string, ...args: any[]) => void;
    warn: (message: string, ...args: any[]) => void;
    debug: (message: string, ...args: any[]) => void;
  };
}

const loggerWithContext = logger as LoggerWithContext;

loggerWithContext.withContext = (context: string) => {
  return {
    info: (message: string, ...args: any[]) =>
      logger.info(message, { context, ...args }),
    error: (message: string, ...args: any[]) =>
      logger.error(message, { context, ...args }),
    warn: (message: string, ...args: any[]) =>
      logger.warn(message, { context, ...args }),
    debug: (message: string, ...args: any[]) =>
      logger.debug(message, { context, ...args }),
  };
};

export default loggerWithContext;
