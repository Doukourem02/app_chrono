import express from 'express';
import { 
  updateDriverStatus, 
  getOnlineDrivers, 
  getDriverDetails,
  getDriverRevenues,
  getDriverStatistics
} from '../controllers/driverController.js';
import { validateDriverStatus } from '../middleware/validators.js';
import { verifyJWTOptional } from '../middleware/verifyTokenOptional.js';

const router = express.Router();


router.put('/:userId/status', verifyJWTOptional, validateDriverStatus, updateDriverStatus);
router.get('/online', getOnlineDrivers);
router.get('/:driverId/details', getDriverDetails);
router.get('/:userId/revenues', getDriverRevenues);
router.get('/:userId/statistics', getDriverStatistics);

export default router;