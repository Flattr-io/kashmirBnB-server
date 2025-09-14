import { Request, Response, Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { DestinationService } from '../services/destination.service';

const router = Router();
const destinationService = new DestinationService();

/**
 * @swagger
 * /destinations:
 *   get:
 *     summary: Get all destinations
 *     description: Returns a list of all destinations. This endpoint is publicly accessible.
 *     tags:
 *       - Destinations
 *     responses:
 *       200:
 *         description: List of destinations
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Destination'
 *       500:
 *         description: Internal server error
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const destinations = await destinationService.getAll();
        res.json(destinations);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch destinations', message: error.message });
    }
});

/**
 * @swagger
 * /destinations:
 *   post:
 *     summary: Create a new destination
 *     description: Adds a new destination with metadata (name, coordinates, etc.).
 *     tags:
 *       - Destinations
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *     responses:
 *       200:
 *         description: Destination created
 *       401:
 *         description: Unauthorized
 */
router.post('/', [authMiddleware], async (req: Request, res: Response) => {
    const { name, slug, area, center, center_lat, center_lng, metadata } = req.body;
    const destination = await destinationService.create({
        name: name,
        slug: slug,
        area: area,
        center: center,
        center_lat: center_lat,
        center_lng: center_lng,
        metadata: metadata,
    });
    res.send(destination);
});

/**
 * @swagger
 * /destinations/{id}:
 *   get:
 *     summary: Get destination by ID
 *     description: Returns a single destination by its ID. This endpoint is publicly accessible.
 *     tags:
 *       - Destinations
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Destination ID
 *     responses:
 *       200:
 *         description: Destination object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Destination'
 *       404:
 *         description: Destination not found
 *       500:
 *         description: Internal server error
 */
router.get('/:destinationId', async (req: Request, res: Response) => {
    try {
        const { destinationId } = req.params;
        const destination = await destinationService.getById({ destinationId: destinationId });
        res.json(destination);
    } catch (error: any) {
        if (error.message?.includes('not found')) {
            res.status(404).json({ error: 'Destination not found' });
        } else {
            res.status(500).json({ error: 'Failed to fetch destination', message: error.message });
        }
    }
});

/**
 * @swagger
 * /destinations/{id}:
 *   patch:
 *     summary: Update a destination
 *     description: Updates metadata of a destination.
 *     tags:
 *       - Destinations
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Destination updated
 *       404:
 *         description: Destination not found
 */
router.patch('/:destinationId', [authMiddleware], async (req: Request, res: Response) => {
    const { destinationId } = req.params;
    const { payload } = req.body;
    const destination = await destinationService.update({ destinationId, payload });
    res.send(destination);
});

/**
 * @swagger
 * /destinations/{id}:
 *   delete:
 *     summary: Delete a destination
 *     description: Removes a destination.
 *     tags:
 *       - Destinations
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Destination deleted
 *       404:
 *         description: Destination not found
 */
router.delete('/:destinationId', [authMiddleware], async (req: Request, res: Response) => {
    const { destinationId } = req.params;
    const result = await destinationService.delete({ destinationId });
    res.send(result);
});

export default router;
