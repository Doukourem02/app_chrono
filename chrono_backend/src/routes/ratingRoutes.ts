import express, { Router } from 'express';
import {
  submitRating,
  getDriverRatings,
  getOrderRating,
} from '../controllers/ratingController.js';
import { verifyJWT } from '../middleware/verifyToken.js';

const router: Router = express.Router();

router.post('/', verifyJWT, submitRating);

router.get('/order/:orderId', verifyJWT, getOrderRating);

router.get('/driver/:driverId', getDriverRatings);

export default router;
