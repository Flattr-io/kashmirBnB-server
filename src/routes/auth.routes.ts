import { Request, Response, Router } from 'express';
import { AuthService } from '../services/auth.service';

const router = Router();
const authService = new AuthService();

/**
 * @swagger
 * /auth/signup:
 *   post:
 *     summary: Sign up a new user
 *     description: Create a new user using email, password, and name. Supabase Auth handles password hashing.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: testuser@example.com
 *               password:
 *                 type: string
 *                 example: StrongPass#123
 *               name:
 *                 type: string
 *                 example: John Doe
 *     responses:
 *       200:
 *         description: User created successfully
 *       400:
 *         description: Bad request (e.g., invalid email or user exists)
 */
router.post('/signup', async (req: Request, res: Response) => {
    const { email, password, name, phone} = req.body;
    const user = await authService.signUp({ email, password, name, phone });
    res.send(user);
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login a user
 *     description: Authenticate a user using email and password. Returns session info with JWT.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: testuser@example.com
 *               password:
 *                 type: string
 *                 example: StrongPass#123
 *     responses:
 *       200:
 *         description: Login successful, returns user session
 *       401:
 *         description: Unauthorized (invalid credentials)
 */
router.post('/login', async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const session = await authService.login({ email, password });
    res.send(session);
});

export default router;
