import express from 'express';
import { 
  updateDriverStatus, 
  getOnlineDrivers, 
  getDriverDetails,
  getDriverRevenues
} from '../controllers/driverController.js';
import { validateDriverStatus } from '../middleware/validators.js';
import { verifyJWTOptional } from '../middleware/verifyTokenOptional.js';

const router = express.Router();

/**
 * 🚗 ROUTES GESTION CHAUFFEURS
 */

// 📍 Mettre à jour le statut et position du chauffeur (authentification optionnelle + validation)
// PUT /api/drivers/:userId/status
// Note: L'authentification est optionnelle pour permettre les appels avant la connexion complète
// Si un token est fourni, il sera vérifié et req.user sera défini
router.put('/:userId/status', verifyJWTOptional, validateDriverStatus, updateDriverStatus);

// 🗺️ Récupérer tous les chauffeurs online
// GET /api/drivers/online
router.get('/online', getOnlineDrivers);

// 🔍 Récupérer les détails d'un chauffeur
// GET /api/drivers/:driverId/details
router.get('/:driverId/details', getDriverDetails);

// 💰 Récupérer les revenus d'un chauffeur
// GET /api/drivers/:userId/revenues?period=today|week|month|all
router.get('/:userId/revenues', getDriverRevenues);

export default router;