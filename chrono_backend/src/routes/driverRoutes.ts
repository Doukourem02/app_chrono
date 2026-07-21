import express, { Router } from 'express';
import { updateDriverStatus, getOnlineDrivers, getDriverDetails,getDriverRevenues,getDriverStatistics,getDriverWorkTime,updateDriverWorkTime,updateDriverVehicle,updateDriverType,updateDriverB2BPreference} from '../controllers/driverController.js';
import { validateDriverStatus } from '../middleware/validators.js';
import { verifyJWTOptional } from '../middleware/verifyTokenOptional.js';
import { verifyJWT } from '../middleware/verifyToken.js';

const router: Router = express.Router();

router.put('/:userId/status', verifyJWT, validateDriverStatus, updateDriverStatus);
router.get('/online', verifyJWT, getOnlineDrivers);
router.get('/:driverId/details', verifyJWT, getDriverDetails);
router.get('/:userId/revenues', verifyJWT, getDriverRevenues);
router.get('/:userId/statistics', verifyJWT, getDriverStatistics);
router.get('/:userId/work-time', verifyJWT, getDriverWorkTime);
router.put('/:userId/work-time', verifyJWT, updateDriverWorkTime);
router.put('/:userId/vehicle', verifyJWT, updateDriverVehicle);
router.put('/:userId/driver-type', verifyJWT, updateDriverType);
router.put('/:userId/b2b-preference', verifyJWT, updateDriverB2BPreference);

export default router;
