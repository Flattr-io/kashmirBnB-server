import { Request, Response, Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { POIWishlistService } from '../services/poi-wishlist.service';

const router = Router();
const poiWishlistService = new POIWishlistService();

/**
 * @swagger
 * /poi-wishlist:
 *   get:
 *     summary: Get wishlist of current user
 *     description: Returns all POIs in the current user's wishlist.
 *     tags:
 *       - POI Wishlist
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of wishlisted POIs
 *       401:
 *         description: Unauthorized
 */
router.get('/:userId', [authMiddleware], async (req: Request, res: Response) => {
    const { userId } = req.params;
    const wishlist = await poiWishlistService.getAllByUser({ userId });
    res.send(wishlist);
});

/**
 * @swagger
 * /poi-wishlist/{poiId}:
 *   post:
 *     summary: Add POI to wishlist
 *     description: Adds a POI to the user's wishlist.
 *     tags:
 *       - POI Wishlist
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: poiId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the POI to wishlist
 *     responses:
 *       200:
 *         description: POI added to wishlist
 *       401:
 *         description: Unauthorized
 */
router.post('/:userId/:poiId', [authMiddleware], async (req: Request, res: Response) => {
    const { userId, poiId } = req.params;
    const result = await poiWishlistService.add({ userId, poiId });
    res.send(result);
});

/**
 * @swagger
 * /poi-wishlist/{poiId}:
 *   delete:
 *     summary: Remove POI from wishlist
 *     description: Removes a POI from the user's wishlist.
 *     tags:
 *       - POI Wishlist
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: poiId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the POI to remove
 *     responses:
 *       200:
 *         description: POI removed from wishlist
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: POI not found in wishlist
 */
router.delete('/:userId/:poiId', [authMiddleware], async (req: Request, res: Response) => {
    const { userId, poiId } = req.params;
    const result = await poiWishlistService.remove({ userId, poiId });
    res.send(result);
});

export default router;
