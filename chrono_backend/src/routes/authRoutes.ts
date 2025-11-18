import express, { Router } from 'express';
import {registerUserWithPostgreSQL,loginUserWithPostgreSQL,checkUserInPostgreSQL,getAllUsersFromPostgreSQL,sendOTPCode,verifyOTPCode,refreshToken,updateUserProfile,uploadAvatar,} from '../controllers/authController.js';
import {authLimiter,otpLimiter,registerLimiter,} from '../middleware/rateLimiter.js';
import { bruteForceProtection } from '../middleware/bruteForceProtection.js';
import {validateRegister,validateLogin,validateSendOTP,validateVerifyOTP,validateRefreshToken,} from '../middleware/validators.js';
import { verifyJWT } from '../middleware/verifyToken.js';

const router: Router = express.Router();

router.post('/send-otp', otpLimiter, bruteForceProtection, validateSendOTP, sendOTPCode);
router.post('/verify-otp', otpLimiter, bruteForceProtection, validateVerifyOTP, verifyOTPCode);
router.post('/refresh-token', validateRefreshToken, refreshToken);
router.get('/check/:email', checkUserInPostgreSQL);
router.post('/register', registerLimiter, bruteForceProtection, validateRegister, registerUserWithPostgreSQL);
router.post('/login', authLimiter, bruteForceProtection, validateLogin, loginUserWithPostgreSQL);
router.get('/users', getAllUsersFromPostgreSQL);
router.put('/users/:userId/profile', verifyJWT, updateUserProfile);
router.post('/users/:userId/avatar', verifyJWT, uploadAvatar);

export default router;
