import { Router } from 'express';
import { getDriverBadges, checkBadges, getLeaderboardRanking, getDriverScore } from '../controllers/gamificationController.js';
import { verifyJWT } from '../middleware/verifyToken.js';

const router = Router();

router.get('/badges/:driverId', verifyJWT, getDriverBadges);
router.post('/badges/:driverId/check', verifyJWT, checkBadges);
router.get('/leaderboard', verifyJWT, getLeaderboardRanking);
router.get('/score/:driverId', verifyJWT, getDriverScore);

export default router;

