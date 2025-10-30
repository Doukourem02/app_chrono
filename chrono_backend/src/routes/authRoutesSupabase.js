const express = require('express');
const router = express.Router();
const { 
  sendRegistrationOTP,
  verifyRegistrationOTP,
  getUserWithProfile
} = require('../controllers/authControllerAdapted');

/**
 * @route POST /api/auth-supabase/send-registration-otp
 * @desc Envoyer un OTP pour l'inscription avec rôle (utilise auth.users)
 */
router.post('/send-registration-otp', sendRegistrationOTP);

/**
 * @route POST /api/auth-supabase/verify-registration-otp
 * @desc Vérifier l'OTP et créer l'utilisateur avec profil (utilise auth.users)
 */
router.post('/verify-registration-otp', verifyRegistrationOTP);

/**
 * @route GET /api/auth-supabase/user/:userId
 * @desc Récupérer un utilisateur avec son profil
 */
router.get('/user/:userId', getUserWithProfile);

module.exports = router;