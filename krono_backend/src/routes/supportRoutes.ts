import { Router } from 'express';
import { searchFAQEntries, createTicket, getTickets } from '../controllers/supportController.js';
import { verifyJWT } from '../middleware/verifyToken.js';

const router = Router();

router.get('/faq', verifyJWT, searchFAQEntries);
router.post('/tickets', verifyJWT, createTicket);
router.get('/tickets', verifyJWT, getTickets);

export default router;

