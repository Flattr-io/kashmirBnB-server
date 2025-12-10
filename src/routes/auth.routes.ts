import { Request, Response, Router } from 'express';
import { AuthService } from '../services/auth.service';
import { authMiddleware } from '../middlewares/auth.middleware';
import { PhoneVerificationService } from '../services/phone-verification.service';
import { UserService } from '../services/user.service';

const router = Router();
const authService = new AuthService();
const userService = new UserService();
const phoneVerificationService = new PhoneVerificationService();

/**
 * @swagger
 * /auth/google-login:
 *   get:
 *     summary: Generate Google OAuth redirect metadata
 *     description: |
 *       Calls Supabase Auth to create a Google OAuth URL that already contains PKCE parameters and prompt configuration.
 *       The endpoint returns the URL payload so that web and mobile clients can decide how to handle the redirect (open in a new tab, deep link, etc.).
 *       The Supabase project must have `SUPABASE_REDIRECT_URL` configured to point back to `/auth/callback`.
 *     tags:
 *       - Auth
 *     responses:
 *       200:
 *         description: Supabase OAuth URL generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthOAuthRedirect'
 *             examples:
 *               success:
 *                 summary: URL generated successfully
 *                 value:
 *                   provider: "google"
 *                   url: "https://fdkcujxhvkwtiaziocpw.supabase.co/auth/v1/oauth/callback?provider=google&code_challenge=..."
 *       400:
 *         description: OAuth configuration error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               config_error:
 *                 summary: Supabase OAuth misconfiguration
 *                 value:
 *                   error: "Bad Request"
 *                   message: "Supabase project is missing OAuth credentials"
 *                   statusCode: 400
 *                   timestamp: "2024-01-15T10:30:00Z"
 *       500:
 *         description: Unexpected error when preparing the OAuth redirect
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/google-login', async (req: Request, res: Response) => {
    const result = await authService.getGoogleOAuthUrl();
    res.send(result);
});

/**
 * @swagger
 * /auth/callback:
 *   get:
 *     summary: Exchange Google OAuth credentials for a Supabase session
 *     description: |
 *       Handles both authorization-code and implicit/token responses coming back from Google/Supabase.
 *       Returns the Supabase user plus session object the client should persist.
 *       When neither a `code` nor `access_token` is present, the endpoint returns a minimal HTML helper page that copies fragment parameters into the query string and reloads itself.
 *     tags:
 *       - Auth
 *     parameters:
 *       - in: query
 *         name: code
 *         required: false
 *         schema:
 *           type: string
 *         description: Authorization code returned by Google when using the PKCE redirect flow
 *         example: "4/0AeanR..."
 *       - in: query
 *         name: access_token
 *         schema:
 *           type: string
 *         description: Supabase access token returned via implicit OAuth flow (fragment params rehydrated by frontend helper)
 *       - in: query
 *         name: refresh_token
 *         schema:
 *           type: string
 *           nullable: true
 *         description: Optional refresh token included in implicit flow responses
 *       - in: query
 *         name: expires_in
 *         schema:
 *           type: integer
 *         description: Seconds until the Supabase access token expires
 *       - in: query
 *         name: expires_at
 *         schema:
 *           type: integer
 *         description: Unix timestamp (seconds) when the Supabase access token expires
 *       - in: query
 *         name: token_type
 *         schema:
 *           type: string
 *         description: Token type to use in the Authorization header (defaults to `bearer`)
 *       - in: query
 *         name: provider_token
 *         schema:
 *           type: string
 *           nullable: true
 *         description: Optional Google access token forwarded by Supabase
 *       - in: query
 *         name: provider_refresh_token
 *         schema:
 *           type: string
 *           nullable: true
 *         description: Optional Google refresh token forwarded by Supabase
 *     responses:
 *       200:
 *         description: Authentication successful, Supabase session returned
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *             examples:
 *               success:
 *                 summary: Successful authentication
 *                 value:
 *                   user:
 *                     id: "123e4567-e89b-12d3-a456-426614174000"
 *                     email: "user@gmail.com"
 *                     user_metadata:
 *                       full_name: "John Doe"
 *                   session:
 *                     access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                     token_type: "bearer"
 *                     expires_in: 3600
 *                     expires_at: 1700000000
 *                     refresh_token: "eyJh..."
 *           text/html:
 *             schema:
 *               type: string
 *               description: Helper page shown when Supabase returns fragment tokens that must be rehydrated into the query string before retrying the same endpoint.
 *             examples:
 *               fragment_handler:
 *                 summary: Fragment rehydration page
 *                 value: "<!DOCTYPE html><html><body><p>Finishing sign in...</p></body></html>"
 *       401:
 *         description: Invalid or expired authorization code/token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               invalid_code:
 *                 summary: Invalid authorization code
 *                 value:
 *                   error: "Unauthorized"
 *                   message: "Invalid or expired authorization credentials"
 *                   statusCode: 401
 *                   timestamp: "2024-01-15T10:30:00Z"
 *       400:
 *         description: Missing authorization code or access token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               missing_code:
 *                 summary: Missing authorization code
 *                 value:
 *                   error: "Bad Request"
 *                   message: "Authorization response missing credentials"
 *                   statusCode: 400
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
 *                   message: "An unexpected error occurred during OAuth callback"
 *                   statusCode: 500
 *                   timestamp: "2024-01-15T10:30:00Z"
 */
router.get('/callback', async (req: Request, res: Response) => {
    const {
        code,
        access_token,
        refresh_token,
        expires_in,
        expires_at,
        token_type,
        provider_token,
        provider_refresh_token,
    } = req.query as Record<string, string | undefined>;

    const hasCode = typeof code === 'string' && code.length > 0;
    const hasAccessToken = typeof access_token === 'string' && access_token.length > 0;

    if (!hasCode && !hasAccessToken) {
        const fallbackRedirect = process.env.CLIENT_URL ? `${process.env.CLIENT_URL}/auth/error` : '/auth/error';
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <title>Finishing sign in...</title>
</head>
<body>
    <p>Finishing sign in...</p>
    <script>
        (function () {
            const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
            if (!hash) {
                window.location.replace(${JSON.stringify(fallbackRedirect)});
                return;
            }
            const params = new URLSearchParams(hash);
            const query = params.toString();
            const separator = query ? '?' : '';
            window.location.replace(window.location.pathname + separator + query);
        })();
    </script>
</body>
</html>`;
        res.type('html').send(html);
        return;
    }

    try {
        if (hasCode && code) {
            const result = await authService.handleOAuthCallback(code);
            res.send(result);
            return;
        }

        if (hasAccessToken && access_token) {
            const result = await authService.handleOAuthTokenResponse({
                accessToken: access_token,
                refreshToken: refresh_token,
                expiresIn: expires_in ? Number(expires_in) : undefined,
                expiresAt: expires_at ? Number(expires_at) : undefined,
                tokenType: token_type,
                providerToken: provider_token,
                providerRefreshToken: provider_refresh_token,
            });
            res.send(result);
            return;
        }

        res.status(400).json({
            error: 'Bad Request',
            message: 'Authorization response missing credentials',
            statusCode: 400,
        });
    } catch (error: any) {
        res.status(error.statusCode || 500).json({
            error: error.name || 'Internal Server Error',
            message: error.message || 'An unexpected error occurred',
            statusCode: error.statusCode || 500,
        });
    }
});

/**
 * @swagger
 * /auth/google-id-token:
 *   post:
 *     summary: Exchange a Google ID token for a Supabase session
 *     description: Accepts a Google-issued ID token (for example from OAuth on the client) and uses Supabase Auth's signInWithIdToken helper to mint a full Supabase session.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idToken
 *             properties:
 *               idToken:
 *                 type: string
 *                 description: Google ID token obtained on the client
 *               nonce:
 *                 type: string
 *                 description: Optional nonce used when generating the ID token
 *     responses:
 *       200:
 *         description: Authentication successful, Supabase session returned
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Missing or invalid ID token payload
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: ID token rejected by Supabase
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/google-id-token', async (req: Request, res: Response) => {
    const { idToken, nonce } = req.body as { idToken?: string; nonce?: string };

    if (!idToken || typeof idToken !== 'string') {
        res.status(400).json({
            error: 'Bad Request',
            message: 'idToken is required in the request body',
            statusCode: 400,
        });
        return;
    }

    try {
        const result = await authService.signInWithGoogleIdToken(
            idToken,
            typeof nonce === 'string' ? nonce : undefined
        );
        res.send(result);
    } catch (error: any) {
        res.status(error.statusCode || 500).json({
            error: error.name || 'Internal Server Error',
            message: error.message || 'An unexpected error occurred',
            statusCode: error.statusCode || 500,
        });
    }
});

/**
 * @swagger
 * /auth/verify-phone:
 *   post:
 *     summary: Verify a user's phone number using a signed token
 *     description: |
 *       Accepts a JWT issued by the phone verification provider. The backend validates the signature
 *       with `PHONE_VERIFICATION_API_KEY` and, when successful, persists the phone number in the user's profile
 *       while marking `verification_status` as `verified`.
 *     tags:
 *       - Auth
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: Signed JWT returned by the phone verification provider
 *     responses:
 *       200:
 *         description: Phone number verified and stored successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 profile:
 *                   $ref: '#/components/schemas/UserProfile'
 *       400:
 *         description: Token missing or payload invalid
 *       401:
 *         description: Authorization missing or verification token rejected
 *       500:
 *         description: Unexpected server error
 */
router.post('/verify-phone', [authMiddleware], async (req: Request, res: Response) => {
    const authUser = (req as any)?.user;
    if (!authUser?.id) {
        res.status(401).json({
            error: 'Unauthorized',
            message: 'User context missing',
            statusCode: 401,
        });
        return;
    }
    const { phoneToken } = req.body;
    if (!phoneToken || typeof phoneToken !== 'string') {
        res.status(400).json({
            error: 'Bad Request',
            message: 'token is required in the request body',
            statusCode: 400,
        });
        return;
    }
    try {
        const { phone } = phoneVerificationService.verifyPhoneToken(phoneToken);
        const profile = await userService.updateProfile({
            userId: authUser.id,
            phone,
            verification_status: 'verified',
        });

        res.send({
            message: 'Phone number verified successfully',
            profile,
        });
    } catch (error: any) {
        res.status(error.statusCode || 500).json({
            error: error.name || 'Internal Server Error',
            message: error.message || 'An unexpected error occurred',
            statusCode: error.statusCode || 500,
        });
    }
});

export default router;
