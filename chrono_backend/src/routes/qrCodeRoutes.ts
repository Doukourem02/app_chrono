import express, { Router } from 'express';
import {generateQRCode,getQRCode,scanQRCode,getScanHistory,} from '../controllers/qrCodeController.js';
import { verifyJWT } from '../middleware/verifyToken.js';

const router: Router = express.Router();

// Routes pour les QR codes
router.post('/orders/:orderId/qr-codes/generate', verifyJWT, generateQRCode);
router.get('/orders/:orderId/qr-codes', verifyJWT, getQRCode);
router.get('/orders/:orderId/qr-codes/scans', verifyJWT, getScanHistory);
router.post('/qr-codes/scan', verifyJWT, scanQRCode);

export default router;

