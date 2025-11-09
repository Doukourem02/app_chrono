import express, { Router } from 'express';
import { 
  registerUserWithPostgreSQL,
  loginUserWithPostgreSQL,
  checkUserInPostgreSQL,
  getAllUsersFromPostgreSQL,
  sendOTPCode,
  verifyOTPCode,
  refreshToken
} from '../controllers/authController.js';
import { authLimiter, otpLimiter, registerLimiter } from '../middleware/rateLimiter.js';
import { bruteForceProtection } from '../middleware/bruteForceProtection.js';
import {
  validateRegister,
  validateLogin,
  validateSendOTP,
  validateVerifyOTP,
  validateRefreshToken
} from '../middleware/validators.js';

const router: Router = express.Router();

// 🔒 Protection contre les attaques par force brute + Rate limiting + Validation
router.post('/register', registerLimiter, bruteForceProtection, validateRegister, registerUserWithPostgreSQL);
router.post('/login', authLimiter, bruteForceProtection, validateLogin, loginUserWithPostgreSQL);
router.post('/send-otp', otpLimiter, bruteForceProtection, validateSendOTP, sendOTPCode);
router.post('/verify-otp', otpLimiter, bruteForceProtection, validateVerifyOTP, verifyOTPCode);
router.post('/refresh-token', validateRefreshToken, refreshToken);

// Endpoints moins sensibles
router.get('/check/:email', checkUserInPostgreSQL);
router.get('/users', getAllUsersFromPostgreSQL);

export default router;

