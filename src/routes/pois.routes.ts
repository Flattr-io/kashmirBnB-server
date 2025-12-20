import { Request, Response, Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { PoiService } from '../services/pois.service';

const router = Router();
const poiService = new PoiService();

/**
 * @swagger
 * /pois:
 *   get:
 *     summary: Get all POIs
 *     description: Returns a list of all points of interest. This endpoint is publicly accessible.
 *     tags:
 *       - POIs
 *     responses:
 *       200:
 *         description: List of POIs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/POI'
 *       500:
 *         description: Internal server error
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const pois = await poiService.getAll();
        res.json(pois);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch POIs', message: error.message });
    }
});

/**
 * @swagger
 * /pois:
 *   post:
 *     summary: Create a new POI
 *     description: Adds a new point of interest.
 *     tags:
 *       - POIs
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ICreatePOIRequest'
 *     responses:
 *       201:
 *         description: POI created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/POI'
 *       400:
 *         description: Bad request - Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       422:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', [authMiddleware], async (req: Request, res: Response) => {
    const poi = await poiService.create({ ...req.body });
    res.send(poi);
});

/**
 * @swagger
 * /pois/{poiId}:
 *   get:
 *     summary: Get POI by ID
 *     description: Returns a single point of interest by its ID. This endpoint is publicly accessible.
 *     tags:
 *       - POIs
 *     parameters:
 *       - in: path
 *         name: poiId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the POI
 *     responses:
 *       200:
 *         description: POI object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/POI'
 *       404:
 *         description: POI not found
 *       500:
 *         description: Internal server error
 */
router.get('/:poiId', async (req: Request, res: Response) => {
    try {
        const { poiId } = req.params;
        const poi = await poiService.getById({ poiId });
        res.json(poi);
    } catch (error: any) {
        if (error.message?.includes('not found')) {
            res.status(404).json({ error: 'POI not found' });
        } else {
            res.status(500).json({ error: 'Failed to fetch POI', message: error.message });
        }
    }
});

/**
 * @swagger
 * /pois/{poiId}:
 *   patch:
 *     summary: Update a POI
 *     description: Updates an existing point of interest.
 *     tags:
 *       - POIs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: poiId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the POI to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/IUpdatePOIRequest'
 *     responses:
 *       200:
 *         description: POI updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/POI'
 *       400:
 *         description: Bad request - Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: POI not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       422:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch('/:poiId', [authMiddleware], async (req: Request, res: Response) => {
    const { poiId } = req.params;
    const poi = await poiService.update({ poiId, ...req.body });
    res.send(poi);
});

/**
 * @swagger
 * /pois/{poiId}:
 *   delete:
 *     summary: Delete a POI
 *     description: Removes a point of interest from the system.
 *     tags:
 *       - POIs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: poiId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the POI to delete
 *     responses:
 *       200:
 *         description: POI deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: POI not found
 */
router.delete('/:poiId', [authMiddleware], async (req: Request, res: Response) => {
    const { poiId } = req.params;
    const result = await poiService.delete({ poiId });
    res.send(result);
});

/**
 * @swagger
 * /pois/by-destination:
 *   get:
 *     summary: Get POIs by destination and zoom level
 *     description: Returns POIs filtered by destination, zoom level, and priority rules. This endpoint is publicly accessible.
 *     tags:
 *       - POIs
 *     parameters:
 *       - in: query
 *         name: destinationId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the destination
 *       - in: query
 *         name: zoomLevel
 *         required: true
 *         schema:
 *           type: integer
 *         description: Current map zoom level
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *         description: Maximum number of POIs to return
 *     responses:
 *       200:
 *         description: Filtered POIs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/POI'
 *       400:
 *         description: Bad request - missing required parameters
 *       500:
 *         description: Internal server error
 */
router.get('/by-destination', async (req: Request, res: Response) => {
    try {
        const { destinationId, zoomLevel, limit } = req.query;
        
        if (!destinationId || !zoomLevel) {
            return res.status(400).json({ 
                error: 'Missing required parameters', 
                message: 'destinationId and zoomLevel are required' 
            });
        }

        const pois = await poiService.getByDestinationAndZoom({
            destinationId: destinationId as string,
            zoom: Number(zoomLevel),
            limit: Number(limit),
        });
        res.json(pois);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch POIs by destination', message: error.message });
    }
});

/**
 * @swagger
 * /pois/stats:
 *   post:
 *     summary: Get POI visit counts
 *     description: Retrieve the number of times specified POIs have been included in booked packages.
 *     tags:
 *       - POIs
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - poiIds
 *             properties:
 *               poiIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of POI IDs to fetch stats for
 *     responses:
 *       200:
 *         description: Map of POI ID to visit count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties:
 *                 type: integer
 *               example:
 *                 "POI_123": 45
 *                 "POI_456": 12
 *       500:
 *         description: Internal server error
 */
router.post('/stats', async (req: Request, res: Response) => {
    try {
        const { poiIds } = req.body;
        if (!Array.isArray(poiIds)) {
            return res.status(400).json({ error: 'poiIds must be an array of strings' });
        }
        const stats = await poiService.getPoiVisitCounts(poiIds);
        res.json(stats);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch POI stats', message: error.message });
    }
});

export default router;
