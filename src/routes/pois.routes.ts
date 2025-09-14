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
 *     description: Returns a list of all points of interest.
 *     tags:
 *       - POIs
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of POIs
 *       401:
 *         description: Unauthorized
 */
router.get('/', [authMiddleware], async (req: Request, res: Response) => {
    const pois = await poiService.getAll();
    res.send(pois);
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
 *       200:
 *         description: Created POI
 *       401:
 *         description: Unauthorized
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
 *     description: Returns a single point of interest by its ID.
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
 *         description: The ID of the POI
 *     responses:
 *       200:
 *         description: POI object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: POI not found
 */
router.get('/:poiId', [authMiddleware], async (req: Request, res: Response) => {
    const { poiId } = req.params;
    const poi = await poiService.getById({ poiId });
    res.send(poi);
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
 *         description: Updated POI
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: POI not found
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
 *     description: Returns POIs filtered by destination, zoom level, and priority rules.
 *     tags:
 *       - POIs
 *     security:
 *       - bearerAuth: []
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
 *     responses:
 *       200:
 *         description: Filtered POIs
 *       401:
 *         description: Unauthorized
 */
router.get('/by-destination', [authMiddleware], async (req: Request, res: Response) => {
    const { destinationId, zoomLevel, limit } = req.query;
    const pois = await poiService.getByDestinationAndZoom({
        destinationId: destinationId as string,
        zoom: Number(zoomLevel),
        limit: Number(limit),
    });
    res.send(pois);
});

export default router;
