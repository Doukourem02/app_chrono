import express from 'express';
import { 
  registerUserWithPostgreSQL,
  loginUserWithPostgreSQL,
  checkUserInPostgreSQL,
  getAllUsersFromPostgreSQL,
  sendOTPCode,
  verifyOTPCode
} from '../controllers/authController.js';

const router = express.Router();


router.post('/register', registerUserWithPostgreSQL);
router.post('/login', loginUserWithPostgreSQL);
router.get('/check/:email', checkUserInPostgreSQL);
router.get('/users', getAllUsersFromPostgreSQL);
router.post('/send-otp', sendOTPCode);
router.post('/verify-otp', verifyOTPCode);

export default router;