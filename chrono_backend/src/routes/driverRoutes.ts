import express, { Router } from 'express';
import { 
  updateDriverStatus, 
  getOnlineDrivers, 
  getDriverDetails,
  getDriverRevenues,
  getDriverStatistics,
  getDriverWorkTime,
  updateDriverWorkTime
} from '../controllers/driverController.js';
import { validateDriverStatus } from '../middleware/validators.js';
import { verifyJWTOptional } from '../middleware/verifyTokenOptional.js';

const router: Router = express.Router();

router.put('/:userId/status', verifyJWTOptional, validateDriverStatus, updateDriverStatus);
router.get('/online', getOnlineDrivers);
router.get('/:driverId/details', getDriverDetails);
router.get('/:userId/revenues', getDriverRevenues);
router.get('/:userId/statistics', getDriverStatistics);
router.get('/:userId/work-time', verifyJWTOptional, getDriverWorkTime);
router.put('/:userId/work-time', verifyJWTOptional, updateDriverWorkTime);

export default router;

