import { Request, Response, Router } from 'express';
import { optionalAuthMiddleware } from '../middlewares/optional-auth.middleware';
import { ChatService } from '../services/chat.service';

const router = Router();
const chatService = new ChatService();

/**
 * @swagger
 * /chat/messages:
 *   get:
 *     summary: Get chat messages
 *     description: Retrieves chat messages based on user's verification status
 *     tags: [Chat]
 *     responses:
 *       200:
 *         description: Chat messages retrieved successfully
 */
router.get('/messages', [optionalAuthMiddleware], async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const chatData = await chatService.getChatMessages(userId);
        res.json(chatData);
    } catch (error: any) {
        res.status(500).json({ error: 'Data fetch failed' });
    }
});

/**
 * @swagger
 * /chat/send:
 *   post:
 *     summary: Send chat message
 *     description: Sends a message to global chat (requires KYC verification)
 *     tags: [Chat]
 */
// router.post('/send', [authMiddleware], async (req: Request, res: Response) => {
//     try {
//         const userId = (req as any).user.id;
//         const { text } = req.body;
//         const result = await chatService.sendMessage(userId, text);
//         if ((result as any).error) return res.status(401).json(result);
//         res.json(result);
//     } catch (error: any) {
//         res.status(500).json({ error: 'Data fetch failed' });
//     }
// });

export default router;
