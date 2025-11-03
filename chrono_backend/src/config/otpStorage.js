import pool from './db.js';
import logger from '../utils/logger.js';

const memoryOTPStore = new Map();

const normalizeEmail = (email = '') => email.trim().toLowerCase();
const normalizePhone = (phone = '') => phone.replace(/[\s().-]/g, '');
const createKey = (email, phone, role) => `${normalizeEmail(email)}|${normalizePhone(phone)}|${role}`;

const setMemoryOTP = (email, phone, role, code, expiresAt) => {
  const key = createKey(email, phone, role);
  memoryOTPStore.set(key, { code, expiresAt });
  logger.debug(`💾 Code OTP stocké en mémoire - Key: ${key}, Code: ${code}, Expire: ${expiresAt}`);
};

const popMemoryOTP = (email, phone, role, code) => {
  const key = createKey(email, phone, role);
  const entry = memoryOTPStore.get(key);
  
  logger.debug(`🔍 Recherche OTP en mémoire - Key: ${key}, Entry existe: ${!!entry}, Code reçu: ${code}`);
  
  if (!entry) {
    logger.warn(`❌ Code OTP non trouvé en mémoire pour ${email}`);
    // Lister toutes les clés pour debug
    logger.debug(`📋 Clés OTP en mémoire: ${Array.from(memoryOTPStore.keys()).join(', ')}`);
    return false;
  }

  const now = new Date();
  if (entry.expiresAt <= now) {
    logger.warn(`❌ Code OTP expiré pour ${email}`);
    memoryOTPStore.delete(key);
    return false;
  }

  if (entry.code !== code) {
    logger.warn(`❌ Code OTP incorrect pour ${email} - Attendu: ${entry.code}, Reçu: ${code}`);
    return false;
  }

  logger.info(`✅ Code OTP valide pour ${email} !`);
  memoryOTPStore.delete(key);
  return true;
};

const getMemoryOTP = (email, phone, role) => {
  const key = createKey(email, phone, role);
  const entry = memoryOTPStore.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= new Date()) {
    memoryOTPStore.delete(key);
    return null;
  }

  return { ...entry, email: normalizeEmail(email), phone: normalizePhone(phone), role };
};

const DATABASE_AVAILABLE = Boolean(process.env.DATABASE_URL);

const fallbackToMemory = (context, error, email, phone, role, code, expiresAt) => {
  const message = error?.message || error;
  if (message) {
    logger.warn(`⚠️ ${context} - utilisation du stockage mémoire OTP: ${message}`);
  } else {
    logger.warn(`⚠️ ${context} - utilisation du stockage mémoire OTP.`);
  }
  setMemoryOTP(email, phone, role, code, expiresAt);
  return { storage: 'memory', fallback: true };
};

/**
 * Stocke un code OTP dans la base de données ou en mémoire si la base est indisponible
 */
export async function storeOTP(email, phone, role, code) {
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  // Vérifier si le pool est vraiment disponible (pas juste si DATABASE_URL est défini)
  const poolAvailable = DATABASE_AVAILABLE && pool !== null;

  if (!poolAvailable) {
    logger.warn('⚠️ Base de données non disponible, utilisation du stockage mémoire');
    return fallbackToMemory('Base de données OTP indisponible', null, email, phone, role, code, expiresAt);
  }

  try {
    const result = await pool.query(
      `INSERT INTO otp_codes (email, phone, role, code, expires_at) 
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email, phone, role) 
       DO UPDATE SET code = $4, expires_at = $5, created_at = NOW()`,
      [normalizeEmail(email), normalizePhone(phone), role, code, expiresAt]
    );
    
    // Vérifier que la requête a vraiment fonctionné (si pool.query retourne toujours rows: [], c'est le mock)
    // Si on utilise le vrai pool et que ça fonctionne, on devrait avoir un rowCount > 0
    if (result && result.rowCount !== undefined && result.rowCount > 0) {
      logger.info('✅ OTP stocké en base de données');
      return { storage: 'database', fallback: false };
    } else {
      // La requête n'a rien retourné, probablement le mock ou connexion échouée
      logger.warn('⚠️ Requête DB retournée vide, fallback vers mémoire');
      return fallbackToMemory('Requête DB vide (probable mock ou connexion échouée)', null, email, phone, role, code, expiresAt);
    }
  } catch (error) {
    logger.error('❌ Erreur lors du stockage OTP:', error);
    return fallbackToMemory('Erreur stockage OTP en base', error, email, phone, role, code, expiresAt);
  }
}

/**
 * Vérifie et supprime un code OTP s'il est valide
 */
export async function verifyOTP(email, phone, role, code) {
  // Vérifier si le pool est vraiment disponible (pas juste si DATABASE_URL est défini)
  const poolAvailable = DATABASE_AVAILABLE && pool !== null;

  if (poolAvailable) {
    try {
      const result = await pool.query(
        `DELETE FROM otp_codes 
         WHERE email = $1 AND phone = $2 AND role = $3 
         AND code = $4 AND expires_at > NOW() 
         RETURNING *`,
        [normalizeEmail(email), normalizePhone(phone), role, code]
      );
      if (result.rows.length > 0) {
        logger.info('✅ Code OTP vérifié et supprimé de la base de données');
        return true;
      }
    } catch (error) {
      logger.error('❌ Erreur lors de la vérification OTP:', error);
    }
  }

  // Fallback vers la mémoire si la base de données n'est pas disponible ou si rien trouvé
  return popMemoryOTP(email, phone, role, code);
}

/**
 * Récupère un code OTP (sans le supprimer)
 */
export async function getOTP(email, phone, role) {
  if (DATABASE_AVAILABLE) {
    try {
      const result = await pool.query(
        `SELECT * FROM otp_codes 
         WHERE email = $1 AND phone = $2 AND role = $3 
         AND expires_at > NOW() 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [normalizeEmail(email), normalizePhone(phone), role]
      );
      if (result.rows[0]) {
        return result.rows[0];
      }
    } catch (error) {
      logger.error('❌ Erreur lors de la récupération OTP:', error);
    }
  }

  return getMemoryOTP(email, phone, role);
}

/**
 * Nettoie les codes OTP expirés
 */
export async function cleanupExpiredOTP() {
  if (!DATABASE_AVAILABLE) {
    let cleaned = 0;
    const now = new Date();
    for (const [key, entry] of memoryOTPStore.entries()) {
      if (entry.expiresAt <= now) {
        memoryOTPStore.delete(key);
        cleaned += 1;
      }
    }

    if (cleaned > 0) {
      logger.info(`🧹 ${cleaned} codes OTP expirés nettoyés (mémoire)`);
    }

    return cleaned;
  }

  try {
    const result = await pool.query(
      `DELETE FROM otp_codes WHERE expires_at < NOW() RETURNING *`
    );
    
    if (result.rows.length > 0) {
      logger.info(`🧹 ${result.rows.length} codes OTP expirés nettoyés`);
    }
    
    return result.rows.length;
  } catch (error) {
    // Ne pas logger en erreur si c'est juste que la table n'existe pas encore
    if (error.message && error.message.includes('does not exist')) {
      if (process.env.NODE_ENV !== 'production') {
        logger.warn('⚠️ Table otp_codes n\'existe pas encore, migrations à exécuter');
      }
    } else if (error.message && error.message.includes('password must be a string')) {
      logger.warn('⚠️ Connexion DB non configurée correctement, nettoyage OTP ignoré');
    } else {
      logger.error('❌ Erreur lors du nettoyage OTP:', error.message);
    }
    return 0;
  }
}

// Nettoyer les codes expirés toutes les 10 minutes
if (typeof setInterval !== 'undefined') {
  const scheduleCleanup = () => {
    cleanupExpiredOTP().catch(() => {
      // Ignorer les erreurs au démarrage
    });
  };

  setTimeout(scheduleCleanup, 5000); // 5 secondes de délai
  setInterval(scheduleCleanup, 10 * 60 * 1000);
}

