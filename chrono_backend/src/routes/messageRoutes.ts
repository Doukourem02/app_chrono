import { Router } from 'express';
import {
  getConversations,
  getConversationById,
  createConversation,
  getMessages,
  sendMessage,
  markMessagesAsRead,
  getUnreadCount,
} from '../controllers/messageController.js';
import { verifyJWT } from '../middleware/verifyToken.js';

const router = Router();

// Toutes les routes nécessitent une authentification
router.use(verifyJWT);

// Routes pour les conversations
router.get('/conversations', getConversations);
router.get('/conversations/:conversationId', getConversationById);
router.post('/conversations', createConversation);

// Routes pour les messages
router.get('/conversations/:conversationId/messages', getMessages);
router.post('/conversations/:conversationId/messages', sendMessage);
router.put('/conversations/:conversationId/read', markMessagesAsRead);

// Route pour le nombre de messages non lus
router.get('/unread-count', getUnreadCount);

export default router;

