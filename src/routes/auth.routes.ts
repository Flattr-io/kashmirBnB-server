import { Request, Response, Router } from 'express';
import { AuthService } from '../services/auth.service';

const router = Router();
const authService = new AuthService();

/**
 * @swagger
 * /auth/signup:
 *   post:
 *     summary: Sign up a new user
 *     description: Create a new user account using email, password, name, and phone. Supabase Auth handles password hashing and validation. Returns user session with JWT tokens.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuthSignupRequest'
 *           examples:
 *             valid_signup:
 *               summary: Valid signup request
 *               value:
 *                 email: "testuser@example.com"
 *                 password: "StrongPass#123"
 *                 name: "John Doe"
 *                 phone: "+91-9876543210"
 *             invalid_email:
 *               summary: Invalid email format
 *               value:
 *                 email: "invalid-email"
 *                 password: "StrongPass#123"
 *                 name: "John Doe"
 *                 phone: "+91-9876543210"
 *     responses:
 *       200:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *             examples:
 *               success:
 *                 summary: Successful signup
 *                 value:
 *                   user:
 *                     id: "123e4567-e89b-12d3-a456-426614174000"
 *                     email: "testuser@example.com"
 *                     name: "John Doe"
 *                     created_at: "2024-01-15T10:30:00Z"
 *                   access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                   refresh_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       400:
 *         description: Bad request - Invalid input data or user already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               user_exists:
 *                 summary: User already exists
 *                 value:
 *                   error: "User already exists"
 *                   message: "A user with this email address already exists"
 *                   statusCode: 400
 *                   timestamp: "2024-01-15T10:30:00Z"
 *               invalid_email:
 *                 summary: Invalid email format
 *                 value:
 *                   error: "Invalid email format"
 *                   message: "Please provide a valid email address"
 *                   statusCode: 400
 *                   timestamp: "2024-01-15T10:30:00Z"
 *               weak_password:
 *                 summary: Weak password
 *                 value:
 *                   error: "Password too weak"
 *                   message: "Password must be at least 8 characters long"
 *                   statusCode: 400
 *                   timestamp: "2024-01-15T10:30:00Z"
 *       422:
 *         description: Validation error - Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *             examples:
 *               missing_fields:
 *                 summary: Missing required fields
 *                 value:
 *                   error: "Validation Error"
 *                   message: "Missing required fields"
 *                   details:
 *                     - field: "email"
 *                       message: "Email is required"
 *                     - field: "password"
 *                       message: "Password is required"
 *                   statusCode: 422
 *                   timestamp: "2024-01-15T10:30:00Z"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               server_error:
 *                 summary: Server error
 *                 value:
 *                   error: "Internal Server Error"
 *                   message: "An unexpected error occurred while creating the user"
 *                   statusCode: 500
 *                   timestamp: "2024-01-15T10:30:00Z"
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
 *     description: Authenticate a user using email and password. Returns session information with JWT access and refresh tokens for API authentication.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuthLoginRequest'
 *           examples:
 *             valid_login:
 *               summary: Valid login request
 *               value:
 *                 email: "testuser@example.com"
 *                 password: "StrongPass#123"
 *             invalid_credentials:
 *               summary: Invalid credentials
 *               value:
 *                 email: "testuser@example.com"
 *                 password: "WrongPassword"
 *     responses:
 *       200:
 *         description: Login successful, returns user session with JWT tokens
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *             examples:
 *               success:
 *                 summary: Successful login
 *                 value:
 *                   user:
 *                     id: "123e4567-e89b-12d3-a456-426614174000"
 *                     email: "testuser@example.com"
 *                     name: "John Doe"
 *                     created_at: "2024-01-15T10:30:00Z"
 *                   access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                   refresh_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       401:
 *         description: Unauthorized - Invalid credentials or user not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               invalid_credentials:
 *                 summary: Invalid credentials
 *                 value:
 *                   error: "Invalid credentials"
 *                   message: "Email or password is incorrect"
 *                   statusCode: 401
 *                   timestamp: "2024-01-15T10:30:00Z"
 *               user_not_found:
 *                 summary: User not found
 *                 value:
 *                   error: "User not found"
 *                   message: "No user found with this email address"
 *                   statusCode: 401
 *                   timestamp: "2024-01-15T10:30:00Z"
 *       400:
 *         description: Bad request - Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               missing_fields:
 *                 summary: Missing required fields
 *                 value:
 *                   error: "Bad Request"
 *                   message: "Email and password are required"
 *                   statusCode: 400
 *                   timestamp: "2024-01-15T10:30:00Z"
 *       422:
 *         description: Validation error - Invalid email format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *             examples:
 *               invalid_email:
 *                 summary: Invalid email format
 *                 value:
 *                   error: "Validation Error"
 *                   message: "Invalid email format"
 *                   details:
 *                     - field: "email"
 *                       message: "Email must be a valid email address"
 *                   statusCode: 422
 *                   timestamp: "2024-01-15T10:30:00Z"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               server_error:
 *                 summary: Server error
 *                 value:
 *                   error: "Internal Server Error"
 *                   message: "An unexpected error occurred during authentication"
 *                   statusCode: 500
 *                   timestamp: "2024-01-15T10:30:00Z"
 */
router.post('/login', async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const session = await authService.login({ email, password });
    res.send(session);
});

export default router;
