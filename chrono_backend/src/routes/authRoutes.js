import express from 'express';
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
import {
  validateRegister,
  validateLogin,
  validateSendOTP,
  validateVerifyOTP,
  validateRefreshToken
} from '../middleware/validators.js';

const router = express.Router();

// 🔒 Rate limiting + Validation sur les endpoints sensibles
router.post('/register', registerLimiter, validateRegister, registerUserWithPostgreSQL);
router.post('/login', authLimiter, validateLogin, loginUserWithPostgreSQL);
router.post('/send-otp', otpLimiter, validateSendOTP, sendOTPCode);
router.post('/verify-otp', otpLimiter, validateVerifyOTP, verifyOTPCode);
router.post('/refresh-token', validateRefreshToken, refreshToken);

// Endpoints moins sensibles
router.get('/check/:email', checkUserInPostgreSQL);
router.get('/users', getAllUsersFromPostgreSQL);

export default router;