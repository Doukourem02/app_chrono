import pool from '../config/db.js';

/**
 * 🔐 Service de gestion des codes OTP en base de données
 * Remplace le stockage en mémoire pour une persistance fiable
 */

/**
 * Stocker un code OTP
 * @param {string} email - Email de l'utilisateur
 * @param {string} phone - Téléphone de l'utilisateur
 * @param {string} role - Rôle (client, driver)
 * @param {string} code - Code OTP généré
 * @param {number} expiresInMinutes - Durée de validité en minutes (défaut: 5)
 */
export async function storeOTP(email, phone, role, code, expiresInMinutes = 5) {
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
  
  try {
    await pool.query(
      `INSERT INTO otp_codes (email, phone, role, code, expires_at, verified)
       VALUES ($1, $2, $3, $4, $5, FALSE)
       ON CONFLICT (email, phone, role) 
       DO UPDATE SET 
         code = $4, 
         expires_at = $5, 
         created_at = NOW(),
         verified = FALSE`,
      [email, phone, role, code, expiresAt]
    );
    
    return { success: true };
  } catch (error) {
    console.error('❌ Erreur lors du stockage OTP:', error);
    throw error;
  }
}

/**
 * Vérifier un code OTP
 * Supprime automatiquement le code après vérification réussie
 * @param {string} email - Email de l'utilisateur
 * @param {string} phone - Téléphone de l'utilisateur
 * @param {string} role - Rôle (client, driver)
 * @param {string} code - Code OTP à vérifier
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export async function verifyOTP(email, phone, role, code) {
  try {
    // Chercher et supprimer le code en une seule requête si valide
    const result = await pool.query(
      `DELETE FROM otp_codes 
       WHERE email = $1 
         AND phone = $2 
         AND role = $3 
         AND code = $4 
         AND expires_at > NOW()
         AND verified = FALSE
       RETURNING *`,
      [email, phone, role, code]
    );
    
    if (result.rows.length === 0) {
      // Vérifier si le code existe mais est expiré
      const expiredResult = await pool.query(
        `SELECT * FROM otp_codes 
         WHERE email = $1 AND phone = $2 AND role = $3 AND code = $4`,
        [email, phone, role, code]
      );
      
      if (expiredResult.rows.length > 0) {
        // Nettoyer les codes expirés
        await pool.query(
          `DELETE FROM otp_codes WHERE expires_at < NOW()`
        );
        return { success: false, message: 'Code OTP expiré' };
      }
      
      return { success: false, message: 'Code OTP incorrect ou déjà utilisé' };
    }
    
    return { success: true };
  } catch (error) {
    console.error('❌ Erreur lors de la vérification OTP:', error);
    throw error;
  }
}

/**
 * Marquer un code OTP comme vérifié (sans le supprimer)
 * Utile pour garder une trace des codes vérifiés
 * @param {string} email - Email de l'utilisateur
 * @param {string} phone - Téléphone de l'utilisateur
 * @param {string} role - Rôle (client, driver)
 * @param {string} code - Code OTP vérifié
 */
export async function markOTPAsVerified(email, phone, role, code) {
  try {
    await pool.query(
      `UPDATE otp_codes 
       SET verified = TRUE 
       WHERE email = $1 AND phone = $2 AND role = $3 AND code = $4`,
      [email, phone, role, code]
    );
  } catch (error) {
    console.error('❌ Erreur lors du marquage OTP:', error);
    throw error;
  }
}

/**
 * Nettoyer les codes OTP expirés
 * Peut être appelée périodiquement pour maintenir la base propre
 */
export async function cleanupExpiredOTP() {
  try {
    const result = await pool.query(
      `DELETE FROM otp_codes WHERE expires_at < NOW() RETURNING *`
    );
    console.log(`🧹 ${result.rowCount} codes OTP expirés supprimés`);
    return { success: true, deleted: result.rowCount };
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage OTP:', error);
    throw error;
  }
}

/**
 * Obtenir les statistiques OTP (pour monitoring)
 */
export async function getOTPStats() {
  try {
    const totalResult = await pool.query('SELECT COUNT(*) FROM otp_codes');
    const expiredResult = await pool.query(
      'SELECT COUNT(*) FROM otp_codes WHERE expires_at < NOW()'
    );
    const verifiedResult = await pool.query(
      'SELECT COUNT(*) FROM otp_codes WHERE verified = TRUE'
    );
    
    return {
      total: parseInt(totalResult.rows[0].count),
      expired: parseInt(expiredResult.rows[0].count),
      verified: parseInt(verifiedResult.rows[0].count),
      active: parseInt(totalResult.rows[0].count) - parseInt(expiredResult.rows[0].count)
    };
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des stats OTP:', error);
    throw error;
  }
}

