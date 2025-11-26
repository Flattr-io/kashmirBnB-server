import { Request, Response, Router } from 'express';
import { optionalAuthMiddleware } from '../middlewares/optional-auth.middleware';
import { ChatService } from '../services/chat.service';

const router = Router();
const chatService = new ChatService();

/**
 * @swagger
 * /chat/messages:
 *   get:
 *     summary: Retrieve curated chat feed for the current user state
 *     description: |
 *       Returns a read-only feed of chat messages. The number of messages and whether they are "rigged"
 *       depends on the caller's verification status (unauthenticated, phone verified or KYC verified).
 *       The Authorization header is optional—when omitted the service behaves like an anonymous visitor.
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *       - {}
 *     responses:
 *       200:
 *         description: Chat messages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatResponse'
 *             examples:
 *               unauthenticated:
 *                 summary: Anonymous visitor limited to scripted conversation
 *                 value:
 *                   userState: "UNAUTHENTICATED"
 *                   canSend: false
 *                   messagesAvailable: 6
 *                   messages:
 *                     - id: "rigged-1"
 *                       text: "We just booked our trip through KashmirBnB!"
 *                       author: "automated"
 *                       timestamp: "2024-10-01T08:11:00.000Z"
 *                       isRigged: true
 *               verified:
 *                 summary: KYC verified user with full feed access
 *                 value:
 *                   userState: "KYC_VERIFIED"
 *                   canSend: true
 *                   messagesAvailable: 50
 *                   messages:
 *                     - id: "0ea9a052-f1c1-4bf2-b207-16173e2f90db"
 *                       text: "Happy to help with Gulmarg stay questions."
 *                       author: "joe_2481"
 *                       timestamp: "2024-10-01T08:11:00.000Z"
 *                       isRigged: false
 *       500:
 *         description: Chat data could not be fetched from Supabase
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
