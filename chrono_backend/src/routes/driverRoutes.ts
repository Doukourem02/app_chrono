import express, { Router } from 'express';
import { updateDriverStatus, getOnlineDrivers, getDriverDetails,getDriverRevenues,getDriverStatistics,getDriverWorkTime,updateDriverWorkTime,updateDriverVehicle,updateDriverType} from '../controllers/driverController.js';
import { validateDriverStatus } from '../middleware/validators.js';
import { verifyJWTOptional } from '../middleware/verifyTokenOptional.js';
import { verifyJWT } from '../middleware/verifyToken.js';

const router: Router = express.Router();

router.put('/:userId/status', verifyJWTOptional, validateDriverStatus, updateDriverStatus);
router.get('/online', getOnlineDrivers);
router.get('/:driverId/details', getDriverDetails);
router.get('/:userId/revenues', getDriverRevenues);
router.get('/:userId/statistics', getDriverStatistics);
router.get('/:userId/work-time', verifyJWTOptional, getDriverWorkTime);
router.put('/:userId/work-time', verifyJWTOptional, updateDriverWorkTime);
router.put('/:userId/vehicle', verifyJWT, updateDriverVehicle);
router.put('/:userId/driver-type', verifyJWT, updateDriverType);

export default router;

