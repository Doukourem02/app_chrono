import pool from './db.js';
import logger from '../utils/logger.js';

interface OTPEntry {
  code: string;
  expiresAt: Date;
}

const memoryOTPStore = new Map<string, OTPEntry>();

const normalizeEmail = (email: string = ''): string => email.trim().toLowerCase();

const normalizePhone = (phone: string = ''): string => phone.replace(/[\s().-]/g, '');

const createKey = (email: string, phone: string, role: string): string =>
  `${normalizeEmail(email)}|${normalizePhone(phone)}|${role}`;

const setMemoryOTP = (
  email: string,
  phone: string,
  role: string,
  code: string,
  expiresAt: Date
): void => {
  const key = createKey(email, phone, role);
  memoryOTPStore.set(key, { code, expiresAt });
  logger.debug(`Code OTP stocké en mémoire - Key: ${key}, Code: ${code}, Expire: ${expiresAt}`);
};

const popMemoryOTP = (
  email: string,
  phone: string,
  role: string,
  code: string
): boolean => {
  const key = createKey(email, phone, role);
  const entry = memoryOTPStore.get(key);
  logger.debug(`Recherche OTP en mémoire - Key: ${key}, Entry existe: ${!!entry}, Code reçu: ${code}`);
  
  if (!entry) {
    logger.warn(`Code OTP non trouvé en mémoire pour ${email}`);
    logger.debug(`Clés OTP en mémoire: ${Array.from(memoryOTPStore.keys()).join(', ')}`);
    return false;
  }
  
  const now = new Date();
  if (entry.expiresAt <= now) {
    logger.warn(`Code OTP expiré pour ${email}`);
    memoryOTPStore.delete(key);
    return false;
  }
  
  if (entry.code !== code) {
    logger.warn(`Code OTP incorrect pour ${email} - Attendu: ${entry.code}, Reçu: ${code}`);
    return false;
  }
  
  logger.info(`Code OTP valide pour ${email} !`);
  memoryOTPStore.delete(key);
  return true;
};

const getMemoryOTP = (
  email: string,
  phone: string,
  role: string
): OTPEntry | null => {
  const key = createKey(email, phone, role);
  const entry = memoryOTPStore.get(key);
  
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= new Date()) {
    memoryOTPStore.delete(key);
    return null;
  }

  return { ...entry };
};

const DATABASE_AVAILABLE = Boolean(process.env.DATABASE_URL);

const fallbackToMemory = (
  context: string,
  error: any,
  email: string,
  phone: string,
  role: string,
  code: string,
  expiresAt: Date
): { storage: string; fallback: boolean } => {
  const message = error?.message || error;
  if (message) {
    logger.warn(`${context} - utilisation du stockage mémoire OTP: ${message}`);
  } else {
    logger.warn(`${context} - utilisation du stockage mémoire OTP.`);
  }
  setMemoryOTP(email, phone, role, code, expiresAt);
  return { storage: 'memory', fallback: true };
};

export async function storeOTP(
  email: string,
  phone: string,
  role: string,
  code: string
): Promise<{ storage: string; fallback: boolean }> {
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  const poolAvailable = DATABASE_AVAILABLE && pool !== null;

  if (!poolAvailable) {
    logger.warn('Base de données non disponible, utilisation du stockage mémoire');
    return fallbackToMemory(
      'Base de données OTP indisponible',
      null,
      email,
      phone,
      role,
      code,
      expiresAt
    );
  }

  try {
    const result = await (pool as any).query(
      `INSERT INTO otp_codes (email, phone, role, code, expires_at) 
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email, phone, role) 
       DO UPDATE SET code = $4, expires_at = $5, created_at = NOW()`,
      [normalizeEmail(email), normalizePhone(phone), role, code, expiresAt]
    ) as any;

    if (result && result.rowCount !== undefined && result.rowCount > 0) {
      logger.info('OTP stocké en base de données');
      return { storage: 'database', fallback: false };
    } else {
      logger.warn('Requête DB retournée vide, fallback vers mémoire');
      return fallbackToMemory(
        'Requête DB vide (probable mock ou connexion échouée)',
        null,
        email,
        phone,
        role,
        code,
        expiresAt
      );
    }
  } catch (error: any) {
    const errorMessage = error?.message || (error instanceof Error ? error.message : String(error));
    logger.error('Erreur lors du stockage OTP:', { error: errorMessage, code: error?.code });
    return fallbackToMemory(
      'Erreur stockage OTP en base',
      error,
      email,
      phone,
      role,
      code,
      expiresAt
    );
  }
}

export async function verifyOTP(
  email: string,
  phone: string,
  role: string,
  code: string
): Promise<boolean> {
  const poolAvailable = DATABASE_AVAILABLE && pool !== null;

  if (poolAvailable) {
    try {
      const result = await (pool as any).query(
        `DELETE FROM otp_codes 
         WHERE email = $1 AND phone = $2 AND role = $3 
         AND code = $4 AND expires_at > NOW() 
         RETURNING *`,
        [normalizeEmail(email), normalizePhone(phone), role, code]
      ) as any;

      if (result.rows && result.rows.length > 0) {
        logger.info('Code OTP vérifié et supprimé de la base de données');
        return true;
      }
    } catch (error: any) {
      const errorMessage = error?.message || (error instanceof Error ? error.message : String(error));
      logger.error('Erreur lors de la vérification OTP:', { error: errorMessage, code: error?.code });
    }
  }

  return popMemoryOTP(email, phone, role, code);
}

export async function getOTP(
  email: string,
  phone: string,
  role: string
): Promise<OTPEntry | null> {
  if (DATABASE_AVAILABLE && pool !== null) {
    try {
      const result = await (pool as any).query(
        `SELECT * FROM otp_codes 
         WHERE email = $1 AND phone = $2 AND role = $3 
         AND expires_at > NOW() 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [normalizeEmail(email), normalizePhone(phone), role]
      ) as any;

      if (result.rows && result.rows[0]) {
        return result.rows[0];
      }
    } catch (error: any) {
      const errorMessage = error?.message || (error instanceof Error ? error.message : String(error));
      logger.error('Erreur lors de la récupération OTP:', { error: errorMessage, code: error?.code });
    }
  }

  return getMemoryOTP(email, phone, role);
}

export async function cleanupExpiredOTP(): Promise<number> {
  if (!DATABASE_AVAILABLE || pool === null) {
    let cleaned = 0;
    const now = new Date();
    
    for (const [key, entry] of memoryOTPStore.entries()) {
      if (entry.expiresAt <= now) {
        memoryOTPStore.delete(key);
        cleaned += 1;
      }
    }

    if (cleaned > 0) {
      logger.info(`${cleaned} codes OTP expirés nettoyés (mémoire)`);
    }
    
    return cleaned;
  }

  try {
    const result = await (pool as any).query(
      `DELETE FROM otp_codes WHERE expires_at < NOW() RETURNING *`
    ) as any;

    if (result.rows && result.rows.length > 0) {
      logger.info(`${result.rows.length} codes OTP expirés nettoyés`);
    }

    return result.rows?.length || 0;
  } catch (error: any) {
    const errorMessage = error?.message || (error instanceof Error ? error.message : String(error));
    if (errorMessage && errorMessage.includes('does not exist')) {
      return 0;
    } else if (errorMessage && errorMessage.includes('password must be a string')) {
      logger.warn('Connexion DB non configurée correctement, nettoyage OTP ignoré');
    } else {
      logger.error('Erreur lors du nettoyage OTP:', { error: errorMessage, code: error?.code });
    }
    return 0;
  }
}

if (typeof setInterval !== 'undefined') {
  const scheduleCleanup = () => {
    cleanupExpiredOTP().catch(() => {
      // Ignore errors in scheduled cleanup
    });
  };

  setTimeout(scheduleCleanup, 5000);
  setInterval(scheduleCleanup, 10 * 60 * 1000);
}
