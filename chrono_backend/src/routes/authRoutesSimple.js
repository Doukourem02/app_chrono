import express from 'express';
import { 
  registerUserWithPostgreSQL,
  loginUserWithPostgreSQL,
  checkUserInPostgreSQL,
  getAllUsersFromPostgreSQL,
  sendOTPCode,
  verifyOTPCode
} from '../controllers/authControllerSimple.js';

const router = express.Router();

/**
 * 📝 ROUTE D'INSCRIPTION : Créer utilisateur dans Supabase ET PostgreSQL
 * 
 * UTILISATION :
 * POST /api/auth-simple/register
 * Body: {
 *   "email": "test@example.com",
 *   "password": "motdepasse123",
 *   "phone": "+33123456789",
 *   "role": "client"  // optionnel, défaut = "client"
 * }
 */
router.post('/register', registerUserWithPostgreSQL);

/**
 * 🔐 ROUTE DE CONNEXION : Connecter utilisateur existant
 * 
 * UTILISATION :
 * POST /api/auth-simple/login
 * Body: {
 *   "email": "test@example.com",
 *   "password": "motdepasse123"
 * }
 */
router.post('/login', loginUserWithPostgreSQL);

/**
 * 🔍 ROUTE DE VÉRIFICATION : Voir si utilisateur existe dans PostgreSQL
 * 
 * UTILISATION :
 * GET /api/auth-simple/check/test@example.com
 */
router.get('/check/:email', checkUserInPostgreSQL);

/**
 * 📋 ROUTE LISTE : Voir TOUS les utilisateurs PostgreSQL
 * 
 * UTILISATION :
 * GET /api/auth-simple/users
 */
router.get('/users', getAllUsersFromPostgreSQL);

/**
 * 📲 ROUTE OTP ENVOI : Envoyer code OTP par email ou SMS
 * 
 * UTILISATION :
 * POST /api/auth-simple/send-otp
 * Body: {
 *   "email": "driver@example.com",
 *   "phone": "+33123456789",
 *   "otpMethod": "email", // ou "sms"
 *   "role": "driver"      // client, driver, partner
 * }
 */
router.post('/send-otp', sendOTPCode);

/**
 * ✅ ROUTE OTP VÉRIFICATION : Vérifier code OTP et créer/connecter utilisateur
 * 
 * UTILISATION :
 * POST /api/auth-simple/verify-otp
 * Body: {
 *   "email": "driver@example.com",
 *   "phone": "+33123456789",
 *   "otp": "123456",
 *   "method": "email",    // ou "sms"
 *   "role": "driver"      // client, driver, partner
 * }
 */
router.post('/verify-otp', verifyOTPCode);

export default router;