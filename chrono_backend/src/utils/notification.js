import { Vonage } from '@vonage/server-sdk'
import { sendOTPEmail } from './emailService.js'

// Configuration Vonage (variables d'environnement)
const vonage = new Vonage({
  apiKey: process.env.VONAGE_API_KEY,
  apiSecret: process.env.VONAGE_API_SECRET
})

/**
 * Génère un code OTP aléatoire
 * @param {number} length - Longueur du code (défaut: 6)
 * @returns {string} Code OTP
 */
export function generateOTP(length = 6) {
  const min = Math.pow(10, length - 1)
  const max = Math.pow(10, length) - 1
  return Math.floor(Math.random() * (max - min + 1) + min).toString()
}

/**
 * Envoie un OTP par email via notre service personnalisé
 * @param {string} email - Adresse email
 * @param {string} phone - Numéro de téléphone (métadonnées)
 * @returns {Promise<Object>} Résultat de l'envoi
 */
export async function sendEmailOTP(email, phone) {
  try {
    // Générer le code OTP
    const otpCode = generateOTP(6)
    
    // Envoyer via notre service email personnalisé
    const result = await sendOTPEmail(email, otpCode, 'CHRONO')
    
    console.log(`📧 Email OTP personnalisé envoyé à: ${email}`)
    console.log(`📱 Téléphone associé: ${phone}`)
    
    return {
      success: true,
      method: 'email',
      otpCode: otpCode, // Retourner le code pour stockage temporaire
      messageId: result.messageId,
      message: 'Code OTP envoyé par email avec succès'
    }
  } catch (error) {
    console.error('Erreur sendEmailOTP:', error)
    throw error
  }
}

/**
 * Envoie un OTP par SMS via Vonage
 * @param {string} phone - Numéro de téléphone (format international)
 * @param {string} brandName - Nom de l'expéditeur (défaut: CHRONO)
 * @returns {Promise<Object>} Résultat de l'envoi
 */
export async function sendSMSOTP(phone, brandName = 'CHRONO') {
  try {
    if (!process.env.VONAGE_API_KEY || !process.env.VONAGE_API_SECRET) {
      throw new Error('Clés API Vonage non configurées')
    }

    // Générer le code OTP
    const otpCode = generateOTP(6)
    
    // Message SMS
    const message = `Votre code de vérification ${brandName}: ${otpCode}. Ne le partagez avec personne.`

    // Envoyer le SMS
    const response = await vonage.sms.send({
      to: phone,
      from: brandName,
      text: message
    })

    if (response.messages[0].status === '0') {
      console.log(`📱 SMS OTP envoyé à ${phone}: ${otpCode}`)
      
      // Retourner le code pour validation (à stocker temporairement)
      return {
        success: true,
        method: 'sms',
        otpCode: otpCode,
        messageId: response.messages[0]['message-id'],
        message: 'Code OTP envoyé par SMS avec succès'
      }
    } else {
      throw new Error(`Erreur SMS: ${response.messages[0]['error-text']}`)
    }
  } catch (error) {
    console.error('Erreur sendSMSOTP:', error)
    throw error
  }
}

/**
 * Vérifie un OTP email personnalisé (pas Supabase)
 * @param {string} email - Adresse email
 * @param {string} otp - Code OTP
 * @param {string} storedCode - Code stocké côté serveur
 * @returns {Promise<Object>} Résultat de la vérification
 */
export async function verifyEmailOTP(email, otp, storedCode) {
  try {
    if (otp !== storedCode) {
      throw new Error('Code OTP invalide')
    }

    console.log(`✅ Email OTP vérifié pour: ${email}`)
    
    // Créer un utilisateur simulé (sans Supabase Auth pour l'email)
    const user = {
      id: `email_user_${Date.now()}`,
      email: email,
      isVerified: true,
      createdAt: new Date().toISOString(),
      supabaseUser: false
    }

    return {
      success: true,
      user: user,
      session: {
        access_token: `email_token_${user.id}`,
        refresh_token: `email_refresh_${user.id}`,
        expires_in: 3600
      }
    }
  } catch (error) {
    console.error('Erreur verifyEmailOTP:', error)
    throw error
  }
}

/**
 * Fonction principale pour envoyer un OTP (email ou SMS)
 * @param {Object} options - Options d'envoi
 * @param {string} options.email - Adresse email
 * @param {string} options.phone - Numéro de téléphone  
 * @param {string} options.method - Méthode: 'email' ou 'sms'
 * @param {string} options.brandName - Nom de l'expéditeur SMS
 * @returns {Promise<Object>} Résultat de l'envoi
 */
export async function sendOTP({ email, phone, method = 'email', brandName = 'CHRONO' }) {
  switch (method) {
    case 'email':
      return await sendEmailOTP(email, phone)
    
    case 'sms':
      return await sendSMSOTP(phone, brandName)
    
    default:
      throw new Error(`Méthode OTP non supportée: ${method}`)
  }
}