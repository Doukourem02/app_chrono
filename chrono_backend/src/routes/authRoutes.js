import express from 'express'
import { sendOTP, verifyEmailOTP } from '../utils/notification.js'

const router = express.Router()

// Store temporaire pour les codes OTP (en production, utiliser Redis)
const pendingUsers = new Map()
const emailOtpSessions = new Map()
const smsOtpSessions = new Map()

// POST /auth/send-otp - Envoyer le code OTP (email ou SMS)
router.post('/send-otp', async (req, res) => {
  try {
    const { phone, email, otpMethod = 'email' } = req.body

    if (!email) {
      return res.status(400).json({ 
        error: 'L\'adresse email est requise' 
      })
    }

    if (!phone) {
      return res.status(400).json({ 
        error: 'Le numéro de téléphone est requis' 
      })
    }

    // Stocker temporairement la relation phone-email
    pendingUsers.set(email, {
      phone: phone,
      createdAt: Date.now(),
      expiresAt: Date.now() + (10 * 60 * 1000) // 10 minutes
    })

    try {
      // Utiliser le module notification unifié
      const result = await sendOTP({
        email: email,
        phone: phone,
        method: otpMethod,
        brandName: 'CHRONO'
      })

      // Pour les emails, stocker le code temporairement
      if (otpMethod === 'email' && result.otpCode) {
        emailOtpSessions.set(email, {
          code: result.otpCode,
          phone: phone,
          createdAt: Date.now(),
          expiresAt: Date.now() + (5 * 60 * 1000) // 5 minutes pour email
        })
      }

      // Pour les SMS, stocker le code temporairement
      if (otpMethod === 'sms' && result.otpCode) {
        smsOtpSessions.set(phone, {
          code: result.otpCode,
          email: email,
          createdAt: Date.now(),
          expiresAt: Date.now() + (5 * 60 * 1000) // 5 minutes pour SMS
        })
      }

      res.json({
        success: true,
        message: result.message,
        method: result.method,
        ...(otpMethod === 'email' ? { email } : { phone })
      })

    } catch (error) {
      console.error('Erreur envoi OTP:', error)
      return res.status(400).json({ 
        error: error.message 
      })
    }

  } catch (error) {
    console.error('Erreur send-otp:', error)
    res.status(500).json({ 
      error: 'Erreur serveur lors de l\'envoi de l\'OTP' 
    })
  }
})

// POST /auth/verify-otp - Vérifier le code OTP (email ou SMS)
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, phone, otp, method = 'email' } = req.body

    if (!otp) {
      return res.status(400).json({ 
        error: 'Le code OTP est requis' 
      })
    }

    if (method === 'email') {
      // Vérification email OTP personnalisé
      if (!email) {
        return res.status(400).json({ 
          error: 'L\'email est requis pour la vérification email OTP' 
        })
      }

      const emailSession = emailOtpSessions.get(email)
      
      if (!emailSession) {
        return res.status(400).json({ 
          error: 'Aucune session Email OTP trouvée pour cette adresse' 
        })
      }

      // Vérifier l'expiration
      if (Date.now() > emailSession.expiresAt) {
        emailOtpSessions.delete(email)
        return res.status(400).json({ 
          error: 'Code Email OTP expiré' 
        })
      }

      // Vérifier le code
      if (emailSession.code !== otp) {
        return res.status(400).json({ 
          error: 'Code Email OTP invalide' 
        })
      }

      // Code email valide - nettoyer la session
      emailOtpSessions.delete(email)

      // Créer un utilisateur pour email personnalisé
      const user = {
        id: `email_user_${Date.now()}`,
        email: email,
        phone: emailSession.phone,
        isVerified: true,
        createdAt: new Date().toISOString(),
        supabaseUser: false
      }

      res.json({
        success: true,
        message: 'Email OTP vérifié avec succès',
        user: user,
        session: {
          access_token: `email_token_${user.id}`,
          refresh_token: `email_refresh_${user.id}`,
          expires_in: 3600
        }
      })

    } else if (method === 'sms') {
      // Vérification SMS OTP
      if (!phone) {
        return res.status(400).json({ 
          error: 'Le téléphone est requis pour la vérification SMS OTP' 
        })
      }

      const smsSession = smsOtpSessions.get(phone)
      
      if (!smsSession) {
        return res.status(400).json({ 
          error: 'Aucune session SMS OTP trouvée pour ce numéro' 
        })
      }

      // Vérifier l'expiration
      if (Date.now() > smsSession.expiresAt) {
        smsOtpSessions.delete(phone)
        return res.status(400).json({ 
          error: 'Code SMS OTP expiré' 
        })
      }

      // Vérifier le code
      if (smsSession.code !== otp) {
        return res.status(400).json({ 
          error: 'Code SMS OTP invalide' 
        })
      }

      // Code SMS valide - nettoyer la session
      smsOtpSessions.delete(phone)

      // Créer un utilisateur pour SMS (sans Supabase Auth)
      const user = {
        id: `sms_user_${Date.now()}`,
        phone: phone,
        email: smsSession.email,
        isVerified: true,
        createdAt: new Date().toISOString(),
        supabaseUser: false
      }

      res.json({
        success: true,
        message: 'SMS OTP vérifié avec succès',
        user: user,
        session: {
          access_token: `sms_token_${user.id}`,
          refresh_token: `sms_refresh_${user.id}`,
          expires_in: 3600
        }
      })

    } else {
      return res.status(400).json({ 
        error: 'Méthode de vérification non supportée' 
      })
    }

  } catch (error) {
    console.error('Erreur verify-otp:', error)
    res.status(500).json({ 
      error: 'Erreur serveur lors de la vérification de l\'OTP' 
    })
  }
})

// POST /auth/logout - Déconnexion
router.post('/logout', async (req, res) => {
  try {
    const { access_token } = req.body

    if (access_token && access_token.startsWith('sms_token_')) {
      // Déconnexion SMS - pas d'action Supabase nécessaire
      console.log('Déconnexion utilisateur SMS')
    } else if (access_token) {
      // Déconnexion Supabase
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Erreur déconnexion Supabase:', error)
      }
    }

    res.json({
      success: true,
      message: 'Déconnexion réussie'
    })
  } catch (error) {
    console.error('Erreur logout:', error)
    res.status(500).json({ 
      error: 'Erreur serveur lors de la déconnexion' 
    })
  }
})

export default router