import { Request, Response, Router } from 'express';
import { AuthService } from '../services/auth.service';

const router = Router();
const authService = new AuthService();

/**
 * @swagger
 * /auth/google:
 *   get:
 *     summary: Initiate Google OAuth authentication
 *     description: Returns a URL that the client should redirect to for Google OAuth authentication. After successful authentication, Google will redirect back to the callback URL with an authorization code.
 *     tags:
 *       - Auth
 *     parameters:
 *       - in: query
 *         name: redirectTo
 *         schema:
 *           type: string
 *           format: uri
 *         description: URL to redirect to after OAuth callback (optional)
 *         example: "http://localhost:3000/auth/callback"
 *     responses:
 *       200:
 *         description: OAuth URL generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *                   format: uri
 *                   description: Google OAuth URL to redirect the user to
 *                   example: "https://accounts.google.com/o/oauth2/v2/auth?..."
 *             examples:
 *               success:
 *                 summary: Successful OAuth URL generation
 *                 value:
 *                   url: "https://accounts.google.com/o/oauth2/v2/auth?client_id=..."
 *       400:
 *         description: Bad request - Invalid redirect URL or OAuth configuration error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               invalid_redirect:
 *                 summary: Invalid redirect URL
 *                 value:
 *                   error: "Bad Request"
 *                   message: "Invalid redirect URL"
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
 *                   message: "An unexpected error occurred while generating OAuth URL"
 *                   statusCode: 500
 *                   timestamp: "2024-01-15T10:30:00Z"
 */
router.get('/google', async (req: Request, res: Response) => {
    const { redirectTo } = req.query;
    const result = await authService.getGoogleOAuthUrl(redirectTo as string | undefined);
    res.send(result);
});

/**
 * @swagger
 * /auth/callback:
 *   get:
 *     summary: Handle OAuth callback
 *     description: Exchanges the authorization code from Google OAuth for a user session. This endpoint is called by Google after successful authentication. Returns user session with JWT tokens.
 *     tags:
 *       - Auth
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Authorization code from Google OAuth
 *         example: "4/0AeanR..."
 *     responses:
 *       200:
 *         description: Authentication successful, returns user session with JWT tokens
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
 *                     name: "John Doe"
 *                     created_at: "2024-01-15T10:30:00Z"
 *                   session:
 *                     access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                     refresh_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       401:
 *         description: Unauthorized - Invalid or expired authorization code
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               invalid_code:
 *                 summary: Invalid authorization code
 *                 value:
 *                   error: "Unauthorized"
 *                   message: "Invalid or expired authorization code"
 *                   statusCode: 401
 *                   timestamp: "2024-01-15T10:30:00Z"
 *       400:
 *         description: Bad request - Missing authorization code
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               missing_code:
 *                 summary: Missing authorization code
 *                 value:
 *                   error: "Bad Request"
 *                   message: "Authorization code is required"
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

export default router;
