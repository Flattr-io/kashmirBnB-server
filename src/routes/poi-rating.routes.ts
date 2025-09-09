import { Request, Response, Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { POIRatingService } from '../services/poi-ratings.service';

const router = Router();
const poiRatingService = new POIRatingService();

/**
 * @swagger
 * /poi-ratings/poi/{poiId}:
 *   get:
 *     summary: Get all ratings for a POI
 *     description: Returns all ratings for a specific POI.
 *     tags:
 *       - POI Ratings
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
 *         description: List of ratings
 *       401:
 *         description: Unauthorized
 */
router.get('/poi/:poiId', [authMiddleware], async (req: Request, res: Response) => {
    const { poiId } = req.params;
    const ratings = await poiRatingService.getAllByPOI({ poiId: poiId });
    res.send(ratings);
});

/**
 * @swagger
 * /poi-ratings/{ratingId}:
 *   get:
 *     summary: Get a rating by ID
 *     description: Returns a single rating.
 *     tags:
 *       - POI Ratings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ratingId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the rating
 *     responses:
 *       200:
 *         description: Rating object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Rating not found
 */
router.get('/:ratingId', [authMiddleware], async (req: Request, res: Response) => {
    const { ratingId } = req.params;
    const rating = await poiRatingService.getById({ ratingId: ratingId });
    res.send(rating);
});

/**
 * @swagger
 * /poi-ratings:
 *   post:
 *     summary: Create a new rating
 *     description: Adds a new rating to a POI.
 *     tags:
 *       - POI Ratings
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               poi_id:
 *                 type: string
 *               user_id:
 *                 type: string
 *               rating:
 *                 type: number
 *                 example: 4
 *               review:
 *                 type: string
 *                 example: "Beautiful place, must visit!"
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *               visit_date:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Created rating
 *       401:
 *         description: Unauthorized
 */
router.post('/', [authMiddleware], async (req: Request, res: Response) => {
    const { poi_id, user_id, rating, review, images, visit_date } = req.body;
    const ratings = await poiRatingService.create({ poi_id, user_id, rating, review, images, visit_date });
    res.send(ratings);
});

/**
 * @swagger
 * /poi-ratings/{ratingId}:
 *   patch:
 *     summary: Update a rating
 *     description: Updates an existing rating.
 *     tags:
 *       - POI Ratings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ratingId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the rating to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rating:
 *                 type: number
 *                 example: 5
 *               review:
 *                 type: string
 *                 example: "Updated review after second visit."
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *               visit_date:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Updated rating
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Rating not found
 */
router.patch('/:ratingId', [authMiddleware], async (req: Request, res: Response) => {
    const { ratingId } = req.params;
    const { payload } = req.body;
    const rating = await poiRatingService.update({ ratingId: ratingId, ...payload });
    res.send(rating);
});

/**
 * @swagger
 * /poi-ratings/{ratingId}:
 *   delete:
 *     summary: Delete a rating
 *     description: Removes a rating.
 *     tags:
 *       - POI Ratings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ratingId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the rating to delete
 *     responses:
 *       200:
 *         description: Rating deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Rating not found
 */
router.delete('/:ratingId', [authMiddleware], async (req: Request, res: Response) => {
    const { ratingId } = req.params;
    const result = await poiRatingService.delete({ ratingId: ratingId });
    res.send(result);
});

export default router;
