import express from 'express';
import {
  submitRating,
  getDriverRatings,
  getOrderRating
} from '../controllers/ratingController.js';
import { verifyJWT } from '../middleware/verifyToken.js';

const router = express.Router();

/**
 * ⭐ ROUTES POUR LES ÉVALUATIONS
 */

// Soumettre une évaluation (client) - requires JWT
router.post('/', verifyJWT, submitRating);

// Vérifier si une commande a déjà été évaluée (client) - requires JWT
router.get('/order/:orderId', verifyJWT, getOrderRating);

// Récupérer les évaluations d'un livreur (public)
router.get('/driver/:driverId', getDriverRatings);

export default router;

