import { Vonage } from '@vonage/server-sdk';
import { sendOTPEmail } from './emailService.js';

// Configuration Vonage (variables d'environnement)
const vonage = process.env.VONAGE_API_KEY && process.env.VONAGE_API_SECRET
  ? new Vonage({
      apiKey: process.env.VONAGE_API_KEY,
      apiSecret: process.env.VONAGE_API_SECRET
    })
  : null;

/**
 * Génère un code OTP aléatoire
 */
export function generateOTP(length: number = 6): string {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return Math.floor(Math.random() * (max - min + 1) + min).toString();
}

/**
 * Envoie un OTP par email via notre service personnalisé
 */
export async function sendEmailOTP(
  email: string,
  phone?: string
): Promise<{
  success: boolean;
  method: string;
  otpCode: string;
  messageId?: string;
  message: string;
}> {
  try {
    // Générer le code OTP
    const otpCode = generateOTP(6);
    
    // Envoyer via notre service email personnalisé
    const result = await sendOTPEmail(email, otpCode, 'CHRONO');
    
    console.log(`📧 Email OTP personnalisé envoyé à: ${email}`);
    if (phone) {
      console.log(`📱 Téléphone associé: ${phone}`);
    }
    
    return {
      success: true,
      method: 'email',
      otpCode: otpCode, // Retourner le code pour stockage temporaire
      messageId: result.messageId,
      message: 'Code OTP envoyé par email avec succès'
    };
  } catch (error: any) {
    console.error('Erreur sendEmailOTP:', error);
    throw error;
  }
}

/**
 * Envoie un OTP par SMS via Vonage
 */
export async function sendSMSOTP(
  phone: string,
  brandName: string = 'CHRONO'
): Promise<{
  success: boolean;
  method: string;
  otpCode: string;
  messageId?: string;
  message: string;
}> {
  try {
    if (!vonage) {
      throw new Error('Clés API Vonage non configurées');
    }

    // Générer le code OTP
    const otpCode = generateOTP(6);
    
    // Message SMS
    const message = `Votre code de vérification ${brandName}: ${otpCode}. Ne le partagez avec personne.`;

    // Envoyer le SMS
    const response = await vonage.sms.send({
      to: phone,
      from: brandName,
      text: message
    });

    if (response.messages[0].status === '0') {
      console.log(`📱 SMS OTP envoyé à ${phone}: ${otpCode}`);
      
      // Retourner le code pour validation (à stocker temporairement)
      return {
        success: true,
        method: 'sms',
        otpCode: otpCode,
        messageId: response.messages[0]['message-id'],
        message: 'Code OTP envoyé par SMS avec succès'
      };
    } else {
      throw new Error(`Erreur SMS: ${response.messages[0]['error-text']}`);
    }
  } catch (error: any) {
    console.error('Erreur sendSMSOTP:', error);
    throw error;
  }
}

/**
 * Vérifie un OTP email personnalisé (pas Supabase)
 */
export async function verifyEmailOTP(
  email: string,
  otp: string,
  storedCode: string
): Promise<{
  success: boolean;
  user: {
    id: string;
    email: string;
    isVerified: boolean;
    createdAt: string;
    supabaseUser: boolean;
  };
  session: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
}> {
  try {
    if (otp !== storedCode) {
      throw new Error('Code OTP invalide');
    }

    console.log(`✅ Email OTP vérifié pour: ${email}`);
    
    // Créer un utilisateur simulé (sans Supabase Auth pour l'email)
    const user = {
      id: `email_user_${Date.now()}`,
      email: email,
      isVerified: true,
      createdAt: new Date().toISOString(),
      supabaseUser: false
    };

    return {
      success: true,
      user: user,
      session: {
        access_token: `email_token_${user.id}`,
        refresh_token: `email_refresh_${user.id}`,
        expires_in: 3600
      }
    };
  } catch (error: any) {
    console.error('Erreur verifyEmailOTP:', error);
    throw error;
  }
}

/**
 * Fonction principale pour envoyer un OTP (email ou SMS)
 */
export async function sendOTP(options: {
  email: string;
  phone?: string;
  method?: 'email' | 'sms';
  brandName?: string;
}): Promise<{
  success: boolean;
  method: string;
  otpCode: string;
  messageId?: string;
  message: string;
}> {
  const { email, phone, method = 'email', brandName = 'CHRONO' } = options;
  
  switch (method) {
    case 'email':
      return await sendEmailOTP(email, phone);
    
    case 'sms':
      if (!phone) {
        throw new Error('Numéro de téléphone requis pour l\'envoi SMS');
      }
      return await sendSMSOTP(phone, brandName);
    
    default:
      throw new Error(`Méthode OTP non supportée: ${method}`);
  }
}

