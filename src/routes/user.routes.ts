import { Request, Response, NextFunction, Router } from 'express';
import createError from 'http-errors';
import { authMiddleware } from '../middlewares/auth.middleware';
import { UserService } from '../services/user.service';
import { requireRoles, requireSelfOrRoles } from '../middlewares/authorization.middleware';

const router = Router();
const userService = new UserService();

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get all users
 *     description: Returns a list of all users.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 *       401:
 *         description: Unauthorized
 */
router.get('/', [authMiddleware, requireRoles('admin')], async (req: Request, res: Response) => {
    const users = await userService.getAllUsers();
    res.send(users);
});

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Create a new user
 *     description: Adds a new user to the system.
 *     tags:
 *       - Users
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
 *                 example: Jane Doe
 *               email:
 *                 type: string
 *                 example: jane.doe@example.com
 *               password:
 *                 type: string
 *                 example: StrongPass#123
 *     responses:
 *       200:
 *         description: Created user
 *       401:
 *         description: Unauthorized
 */
router.post('/', [authMiddleware], async (req: Request, res: Response, next: NextFunction) => {
    return next(createError(405, 'Method Not Allowed'));
});

/**
 * @swagger
 * /users/{userId}:
 *   get:
 *     summary: Get user by ID
 *     description: Returns a single user by their ID.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user
 *     responses:
 *       200:
 *         description: User object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.get('/:userId', [authMiddleware, requireSelfOrRoles('userId', 'admin')], async (req: Request, res: Response) => {
    const user = await userService.getById({ userId: req.params.userId });
    res.send(user);
});

/**
 * @swagger
 * /users/{userId}:
 *   patch:
 *     summary: Update a user
 *     description: Updates an existing user's information.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Jane Smith
 *               email:
 *                 type: string
 *                 example: jane.smith@example.com
 *               password:
 *                 type: string
 *                 example: NewStrongPass#456
 *     responses:
 *       200:
 *         description: Updated user
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.patch('/:userId', [authMiddleware, requireSelfOrRoles('userId', 'admin')], async (req: Request, res: Response) => {
    const user = await userService.update({ userId: req.params.userId, ...req.body });
    res.send(user);
});

/**
 * @swagger
 * /users/{userId}:
 *   delete:
 *     summary: Delete a user
 *     description: Removes a user from the system.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user to delete
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.delete('/:userId', [authMiddleware, requireSelfOrRoles('userId', 'admin')], async (req: Request, res: Response) => {
    const result = await userService.delete({ userId: req.params.userId });
    res.send(result);
});

export default router;
