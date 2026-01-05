import { Request, Response, Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { DocumentService } from '../services/document.service';

const router = Router();
const documentService = new DocumentService();

/**
 * @swagger
 * /documents/upload-url:
 *   post:
 *     summary: Generate a signed S3 upload URL
 *     description: Returns a short-lived signed URL that lets the authenticated user upload a document directly to S3.
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fileName, contentType]
 *             properties:
 *               fileName:
 *                 type: string
 *                 example: passport.pdf
 *               contentType:
 *                 type: string
 *                 example: application/pdf
 *               documentType:
 *                 type: string
 *                 example: kyc_passport
 *     responses:
 *       200:
 *         description: Signed URL created
 *       400:
 *         description: Missing or invalid payload
 *       401:
 *         description: Unauthorized
 */
router.post('/upload-url', [authMiddleware], async (req: Request, res: Response) => {
    try {
        const authUser = (req as any)?.user;
        const { fileName, contentType, documentType } = req.body || {};

        if (!fileName || !contentType) {
            return res.status(400).json({ error: 'fileName and contentType are required' });
        }

        const signedUrl = await documentService.generateUploadUrl({
            userId: authUser.id,
            fileName,
            contentType,
            documentType,
        });

        res.json(signedUrl);
    } catch (error: any) {
        res.status(400).json({ error: error?.message || 'Unable to generate upload URL' });
    }
});

/**
 * @swagger
 * /documents/confirm:
 *   post:
 *     summary: Confirm an uploaded document
 *     description: Confirms that the user uploaded to S3 and records the document URL and status in Supabase.
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [objectKey]
 *             properties:
 *               objectKey:
 *                 type: string
 *                 example: user-documents/123/1700000000000-passport.pdf
 *               documentType:
 *                 type: string
 *                 example: kyc_passport
 *               fileName:
 *                 type: string
 *                 example: passport.pdf
 *               contentType:
 *                 type: string
 *                 example: application/pdf
 *     responses:
 *       200:
 *         description: Document recorded
 *       400:
 *         description: Missing or invalid payload
 *       401:
 *         description: Unauthorized
 */
router.post('/confirm', [authMiddleware], async (req: Request, res: Response) => {
    try {
        const authUser = (req as any)?.user;
        const { objectKey, documentType, fileName, contentType } = req.body || {};

        if (!objectKey) {
            return res.status(400).json({ error: 'objectKey is required' });
        }

        const document = await documentService.confirmUpload({
            userId: authUser.id,
            objectKey,
            documentType,
            fileName,
            contentType,
        });

        res.json({ document });
    } catch (error: any) {
        res.status(400).json({ error: error?.message || 'Unable to confirm upload' });
    }
});

/**
 * @swagger
 * /documents/me:
 *   get:
 *     summary: List the authenticated user's documents
 *     description: Returns the user's uploaded documents with their verification status and URLs.
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of documents
 *       401:
 *         description: Unauthorized
 */
router.get('/me', [authMiddleware], async (req: Request, res: Response) => {
    try {
        const authUser = (req as any)?.user;
        const documents = await documentService.getDocumentsForUser(authUser.id);
        res.json({ documents });
    } catch (error: any) {
        res.status(400).json({ error: error?.message || 'Unable to fetch documents' });
    }
});

export default router;
