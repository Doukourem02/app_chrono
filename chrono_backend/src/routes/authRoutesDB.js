// Test routes for PostgreSQL integration
import express from 'express';
import {
  sendRegistrationOTP,
  verifyRegistrationOTP
} from '../controllers/authControllerWithDB.js';

const router = express.Router();

// Routes PostgreSQL avec rôles
router.post('/send-registration-otp-db', sendRegistrationOTP);
router.post('/verify-registration-otp-db', verifyRegistrationOTP);

export default router;