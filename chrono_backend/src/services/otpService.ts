import pool from '../config/db.js';


export async function storeOTP(
  email: string,
  phone: string,
  role: string,
  code: string,
  expiresInMinutes: number = 5
): Promise<{ success: boolean }> {
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
  
  try {
    await (pool as any).query(
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
  } catch (error: any) {
    console.error('❌ Erreur lors du stockage OTP:', error);
    throw error;
  }
}


export async function verifyOTP(
  email: string,
  phone: string,
  role: string,
  code: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const result = await (pool as any).query(
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
    
    if (!result.rows || result.rows.length === 0) {
      // Vérifier si le code existe mais est expiré
      const expiredResult = await (pool as any).query(
        `SELECT * FROM otp_codes 
         WHERE email = $1 AND phone = $2 AND role = $3 AND code = $4`,
        [email, phone, role, code]
      );
      
      if (expiredResult.rows && expiredResult.rows.length > 0) {
        // Nettoyer les codes expirés
        await (pool as any).query(
          `DELETE FROM otp_codes WHERE expires_at < NOW()`
        );
        return { success: false, message: 'Code OTP expiré' };
      }
      
      return { success: false, message: 'Code OTP incorrect ou déjà utilisé' };
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('❌ Erreur lors de la vérification OTP:', error);
    throw error;
  }
}

/**
 * Marquer un code OTP comme vérifié (sans le supprimer)
 * Utile pour garder une trace des codes vérifiés
 */
export async function markOTPAsVerified(
  email: string,
  phone: string,
  role: string,
  code: string
): Promise<void> {
  try {
    await (pool as any).query(
      `UPDATE otp_codes 
       SET verified = TRUE 
       WHERE email = $1 AND phone = $2 AND role = $3 AND code = $4`,
      [email, phone, role, code]
    );
  } catch (error: any) {
    console.error('❌ Erreur lors du marquage OTP:', error);
    throw error;
  }
}

/**
 * Nettoyer les codes OTP expirés
 * Peut être appelée périodiquement pour maintenir la base propre
 */
export async function cleanupExpiredOTP(): Promise<{ success: boolean; deleted: number }> {
  try {
    const result = await (pool as any).query(
      `DELETE FROM otp_codes WHERE expires_at < NOW() RETURNING *`
    );
    console.log(`🧹 ${result.rowCount || 0} codes OTP expirés supprimés`);
    return { success: true, deleted: result.rowCount || 0 };
  } catch (error: any) {
    console.error('❌ Erreur lors du nettoyage OTP:', error);
    throw error;
  }
}

/**
 * Obtenir les statistiques OTP (pour monitoring)
 */
export async function getOTPStats(): Promise<{
  total: number;
  expired: number;
  verified: number;
  active: number;
}> {
  try {
    const totalResult = await (pool as any).query('SELECT COUNT(*) FROM otp_codes');
    const expiredResult = await (pool as any).query(
      'SELECT COUNT(*) FROM otp_codes WHERE expires_at < NOW()'
    );
    const verifiedResult = await (pool as any).query(
      'SELECT COUNT(*) FROM otp_codes WHERE verified = TRUE'
    );
    
    const total = parseInt(totalResult.rows[0]?.count || '0');
    const expired = parseInt(expiredResult.rows[0]?.count || '0');
    const verified = parseInt(verifiedResult.rows[0]?.count || '0');
    
    return {
      total,
      expired,
      verified,
      active: total - expired
    };
  } catch (error: any) {
    console.error('❌ Erreur lors de la récupération des stats OTP:', error);
    throw error;
  }
}

