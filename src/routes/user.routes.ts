import { Request, Response, NextFunction, Router } from 'express';
import createError from 'http-errors';
import { authMiddleware } from '../middlewares/auth.middleware';
import { UserService } from '../services/user.service';
import { requireRoles, requireSelfOrRoles } from '../middlewares/authorization.middleware';

const router = Router();
const userService = new UserService();

/**
 * @swagger
 * /users/me/profile:
 *   get:
 *     summary: Get the authenticated user's profile
 *     description: Returns the complete record from user_profiles for the currently authenticated user.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Authenticated user's profile
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Profile not found
 */
router.get('/me/profile', [authMiddleware], async (req: Request, res: Response) => {
    const authUser = (req as any)?.user;
    if (!authUser?.id) {
        return res.status(401).json({ error: 'Unauthorized', message: 'User context missing' });
    }

    const profile = await userService.getProfileByUserId(authUser.id);
    res.send(profile);
});

/**
 * @swagger
 * /users/me/profile:
 *   patch:
 *     summary: Update the authenticated user's profile
 *     description: Updates the profile fields for the currently authenticated user. Supports updating phone, verification_status, and other profile fields.
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
 *               full_name:
 *                 type: string
 *                 example: Jane Smith
 *               phone:
 *                 type: string
 *                 example: "+1234567890"
 *               avatar_url:
 *                 type: string
 *                 example: "https://example.com/avatar.jpg"
 *               bio:
 *                 type: string
 *                 example: "Travel enthusiast"
 *               location:
 *                 type: string
 *                 example: "New York, NY"
 *               verification_status:
 *                 type: string
 *                 enum: [unverified, pending, verified, rejected]
 *                 example: verified
 *               gender:
 *                 type: string
 *                 enum: [male, female, other, prefer_not_to_say]
 *                 example: female
 *               online_status:
 *                 type: string
 *               online_status:
 *                 type: string
 *                 enum: [online, offline, away, busy]
 *                 example: online
 *               is_private:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Bad request (invalid field values)
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Profile not found
 */
router.patch('/me/profile', [authMiddleware], async (req: Request, res: Response) => {
    const authUser = (req as any)?.user;
    if (!authUser?.id) {
        return res.status(401).json({ error: 'Unauthorized', message: 'User context missing' });
    }

    const profile = await userService.updateProfile({ userId: authUser.id, ...req.body });
    res.send(profile);
});

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
 * /users/{userId}/preview:
 *   get:
 *     summary: Get user public profile
 *     description: Returns the public profile of a user. If private, limited info is returned.
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
 *         description: Public profile object
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string }
 *                 full_name: { type: string }
 *                 avatar_url: { type: string }
 *                 bio: { type: string }
 *                 location: { type: string }
 *                 verification_status: { type: string }
 *                 kyc_status: { type: string }
 *                 online_status: { type: string }
 *                 is_private: { type: boolean }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.get('/:userId/preview', [authMiddleware], async (req: Request, res: Response) => {
    try {
        const profile = await userService.getPublicProfile(req.params.userId);
        res.send(profile);
    } catch (error: any) {
        if (error.statusCode === 404 || error.message?.includes('not found')) {
            return res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
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

/**
 * @swagger
 * /users/{userId}/profile:
 *   patch:
 *     summary: Update a user's profile
 *     description: Updates profile fields for a specific user. Users can update their own profile; admins can update any profile. Supports updating phone, verification_status, and other profile fields.
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
 *         description: The ID of the user whose profile to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               full_name:
 *                 type: string
 *                 example: Jane Smith
 *               phone:
 *                 type: string
 *                 example: "+1234567890"
 *               avatar_url:
 *                 type: string
 *                 example: "https://example.com/avatar.jpg"
 *               bio:
 *                 type: string
 *                 example: "Travel enthusiast"
 *               location:
 *                 type: string
 *                 example: "New York, NY"
 *               verification_status:
 *                 type: string
 *                 enum: [unverified, pending, verified, rejected]
 *                 example: verified
 *               gender:
 *                 type: string
 *                 enum: [male, female, other, prefer_not_to_say]
 *                 example: female
 *               online_status:
 *                 type: string
 *                 enum: [online, offline, away, busy]
 *                 example: online
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Bad request (invalid field values)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not own profile and not admin)
 *       404:
 *         description: Profile not found
 */
router.patch('/:userId/profile', [authMiddleware, requireSelfOrRoles('userId', 'admin')], async (req: Request, res: Response) => {
    const profile = await userService.updateProfile({ userId: req.params.userId, ...req.body });
    res.send(profile);
});

export default router;
