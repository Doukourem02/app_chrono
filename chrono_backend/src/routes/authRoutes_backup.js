import express from 'express'
import { supabase } from '../config/supabase.js'
import { sendOTP, verifyEmailOTP } from '../utils/notification.js'

const router = express.Router()

// Store temporaire pour associer téléphone/email et codes SMS (en production, utiliser Redis)
const pendingUsers = new Map()
const smsOtpSessions = new Map()

// POST /auth/send-otp - Envoyer le code OTP par email
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

    if (otpMethod === 'email') {
      // Utiliser Supabase Auth pour envoyer l'OTP par email
      const { data, error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          shouldCreateUser: true,
          data: {
            phone: phone // Métadonnées utilisateur
          }
        }
      })

      if (error) {
        console.error('Erreur Supabase signInWithOtp:', error)
        return res.status(400).json({ 
          error: 'Erreur lors de l\'envoi de l\'email OTP: ' + error.message 
        })
      }

      console.log(`� Email OTP envoyé à: ${email}`)
      console.log(`� Téléphone associé: ${phone}`)
      
      res.json({
        success: true,
        message: 'Code OTP envoyé par email avec succès',
        method: 'email',
        email: email
      })
    } else {
      // Pour l'instant, seul l'email est supporté
      return res.status(400).json({ 
        error: 'Méthode OTP non supportée. Utilisez "email"' 
      })
    }

  } catch (error) {
    console.error('Erreur send-otp:', error)
    res.status(500).json({ 
      error: 'Erreur serveur lors de l\'envoi de l\'OTP' 
    })
  }
})

// POST /auth/verify-otp - Vérifier le code OTP email
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body

    if (!email || !otp) {
      return res.status(400).json({ 
        error: 'L\'email et le code OTP sont requis' 
      })
    }

    // Vérifier l'OTP avec Supabase Auth
    const { data, error } = await supabase.auth.verifyOtp({
      email: email,
      token: otp,
      type: 'email'
    })

    if (error) {
      console.error('Erreur Supabase verifyOtp:', error)
      return res.status(400).json({ 
        error: 'Code OTP invalide ou expiré: ' + error.message 
      })
    }

    // Récupérer les données du téléphone depuis le store temporaire
    const pendingUser = pendingUsers.get(email)
    let phone = null
    
    if (pendingUser && Date.now() <= pendingUser.expiresAt) {
      phone = pendingUser.phone
      pendingUsers.delete(email) // Nettoyer
    }

    // Utilisateur authentifié avec succès
    const user = {
      id: data.user.id,
      email: data.user.email,
      phone: phone,
      isVerified: true,
      createdAt: data.user.created_at,
      supabaseUser: true
    }

    console.log(`✅ Email OTP vérifié avec succès pour ${email}`)

    res.json({
      success: true,
      message: 'OTP vérifié avec succès',
      user: user,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in
      }
    })

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

    if (access_token) {
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