import { Request, Response, Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { POICategoryService } from '../services/poi-category.service';

const router = Router();
const poiCategoryService = new POICategoryService();

/**
 * @swagger
 * /poi-categories:
 *   get:
 *     summary: Get all POI categories
 *     description: Returns a list of all POI categories.
 *     tags:
 *       - POI Categories
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of POI categories
 *       401:
 *         description: Unauthorized
 */
router.get('/', [authMiddleware], async (req: Request, res: Response) => {
    const categories = await poiCategoryService.getAllCategories();
    res.send(categories);
});

/**
 * @swagger
 * /poi-categories:
 *   post:
 *     summary: Create a new POI category
 *     description: Adds a new POI category to the system.
 *     tags:
 *       - POI Categories
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
 *                 example: Historical Site
 *               icon:
 *                 type: string
 *                 example: landmark
 *               color:
 *                 type: string
 *                 example: "#FF5733"
 *               description:
 *                 type: string
 *                 example: Ancient monuments and heritage sites
 *     responses:
 *       200:
 *         description: Created POI category
 *       401:
 *         description: Unauthorized
 */
router.post('/', [authMiddleware], async (req: Request, res: Response) => {
    const { name, icon, color, description } = req.body;
    const category = await poiCategoryService.create({ name, icon, color, description });
    res.send(category);
});

/**
 * @swagger
 * /poi-categories/{categoryId}:
 *   get:
 *     summary: Get POI category by ID
 *     description: Returns a single POI category by its ID.
 *     tags:
 *       - POI Categories
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the POI category
 *     responses:
 *       200:
 *         description: POI category object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: POI category not found
 */
router.get('/:categoryId', [authMiddleware], async (req: Request, res: Response) => {
    const { categoryId } = req.params;
    const category = await poiCategoryService.getById({ categoryId: categoryId });
    res.send(category);
});

/**
 * @swagger
 * /poi-categories/{categoryId}:
 *   patch:
 *     summary: Update a POI category
 *     description: Updates an existing POI category.
 *     tags:
 *       - POI Categories
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the POI category to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Natural Attraction
 *               icon:
 *                 type: string
 *                 example: tree
 *               color:
 *                 type: string
 *                 example: "#228B22"
 *               description:
 *                 type: string
 *                 example: Mountains, lakes, forests
 *     responses:
 *       200:
 *         description: Updated POI category
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: POI category not found
 */
router.patch('/:categoryId', [authMiddleware], async (req: Request, res: Response) => {
    const { categoryId } = req.params;
    const { payload } = req.body;
    const category = await poiCategoryService.update({ categoryId: categoryId, ...payload });
    res.send(category);
});

/**
 * @swagger
 * /poi-categories/{categoryId}:
 *   delete:
 *     summary: Delete a POI category
 *     description: Removes a POI category from the system.
 *     tags:
 *       - POI Categories
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the POI category to delete
 *     responses:
 *       200:
 *         description: POI category deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: POI category not found
 */
router.delete('/:categoryId', [authMiddleware], async (req: Request, res: Response) => {
    const { categoryId } = req.params;
    const result = await poiCategoryService.delete({ categoryId: categoryId });
    res.send(result);
});

export default router;
