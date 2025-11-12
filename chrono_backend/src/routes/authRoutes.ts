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

/**
 * @swagger
 * /api/auth-simple/send-otp:
 *   post:
 *     summary: Envoyer un code OTP
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - method
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               phone:
 *                 type: string
 *                 example: +221771234567
 *               method:
 *                 type: string
 *                 enum: [email, sms]
 *                 example: email
 *               role:
 *                 type: string
 *                 enum: [client, driver]
 *                 default: client
 *     responses:
 *       200:
 *         description: Code OTP envoyé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Code OTP envoyé avec succès
 *       400:
 *         description: Erreur de validation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Trop de requêtes
 */
router.post('/send-otp', otpLimiter, bruteForceProtection, validateSendOTP, sendOTPCode);

/**
 * @swagger
 * /api/auth-simple/verify-otp:
 *   post:
 *     summary: Vérifier un code OTP et obtenir les tokens
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *               - method
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               phone:
 *                 type: string
 *                 example: +221771234567
 *               otp:
 *                 type: string
 *                 example: "123456"
 *               method:
 *                 type: string
 *                 enum: [email, sms]
 *                 example: email
 *               role:
 *                 type: string
 *                 enum: [client, driver]
 *                 default: client
 *     responses:
 *       200:
 *         description: Code OTP vérifié avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 accessToken:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 refreshToken:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       400:
 *         description: Code OTP incorrect ou expiré
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Trop de requêtes
 */
router.post('/verify-otp', otpLimiter, bruteForceProtection, validateVerifyOTP, verifyOTPCode);

/**
 * @swagger
 * /api/auth-simple/refresh-token:
 *   post:
 *     summary: Rafraîchir le token d'accès
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: Token rafraîchi avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 accessToken:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       401:
 *         description: Token invalide ou expiré
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/refresh-token', validateRefreshToken, refreshToken);

/**
 * @swagger
 * /api/auth-simple/check/{email}:
 *   get:
 *     summary: Vérifier si un utilisateur existe
 *     tags: [Authentication]
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *         example: user@example.com
 *     responses:
 *       200:
 *         description: Utilisateur trouvé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 exists:
 *                   type: boolean
 *                   example: true
 *       404:
 *         description: Utilisateur non trouvé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 exists:
 *                   type: boolean
 *                   example: false
 */
router.get('/check/:email', checkUserInPostgreSQL);

// 🔒 Protection contre les attaques par force brute + Rate limiting + Validation
router.post('/register', registerLimiter, bruteForceProtection, validateRegister, registerUserWithPostgreSQL);
router.post('/login', authLimiter, bruteForceProtection, validateLogin, loginUserWithPostgreSQL);

// Endpoints moins sensibles
router.get('/users', getAllUsersFromPostgreSQL);

export default router;
