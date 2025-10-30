import express from 'express';
import { 
  updateDriverStatus, 
  getOnlineDrivers, 
  getDriverDetails 
} from '../controllers/driverController.js';

const router = express.Router();

/**
 * 🚗 ROUTES GESTION CHAUFFEURS
 */

// 📍 Mettre à jour le statut et position du chauffeur
// PUT /api/drivers/:userId/status
router.put('/:userId/status', updateDriverStatus);

// 🗺️ Récupérer tous les chauffeurs online
// GET /api/drivers/online
router.get('/online', getOnlineDrivers);

// 🔍 Récupérer les détails d'un chauffeur
// GET /api/drivers/:driverId/details
router.get('/:driverId/details', getDriverDetails);

export default router;