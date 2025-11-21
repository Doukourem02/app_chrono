import { Router } from 'express';
import {getConversations,getConversationById,createConversation,getMessages,sendMessage,markMessagesAsRead,getUnreadCount} from '../controllers/messageController.js';
import { verifyJWT } from '../middleware/verifyToken.js';

const router = Router();

router.use(verifyJWT);

router.get('/conversations', getConversations);
router.get('/conversations/:conversationId', getConversationById);
router.post('/conversations', createConversation);
router.get('/conversations/:conversationId/messages', getMessages);
router.post('/conversations/:conversationId/messages', sendMessage);
router.put('/conversations/:conversationId/read', markMessagesAsRead);
router.get('/unread-count', getUnreadCount);

export default router;

