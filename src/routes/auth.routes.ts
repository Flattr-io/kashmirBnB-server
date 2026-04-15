import { Request, Response, Router } from 'express';
import { AuthService } from '../services/auth.service';
import { authMiddleware } from '../middlewares/auth.middleware';
import { PhoneVerificationService } from '../services/phone-verification.service';
import { UserService } from '../services/user.service';
import { ChatService } from '../services/chat.service';
import { formatProfileFullName } from '../constants/user-profile.schema';
import { getErrorHttpStatus } from '../utils/http-error-status.util';

const router = Router();
const authService = new AuthService();
const userService = new UserService();
const phoneVerificationService = new PhoneVerificationService();
const chatService = new ChatService();

/**
 * @swagger
 * /auth/phone-email/config:
 *   get:
 *     summary: Public Phone.Email client config for WebView / web
 *     description: |
 *       Returns the Phone.Email **Client ID** from env (`PHONE_EMAIL_CLIENT_ID`). This is safe to embed in mobile/web clients
 *       (same idea as an OAuth client id). **Do not** put `PHONE_VERIFICATION_API_KEY` in the app — it stays server-only for JWT verification
 *       and optional backend fetches of `user_json_url`.
 *     tags:
 *       - Auth
 *     responses:
 *       200:
 *         description: Provider metadata and client id when configured
 */
router.get('/phone-email/config', (_req: Request, res: Response) => {
    res.json({
        provider: 'phone.email',
        clientId: process.env.PHONE_EMAIL_CLIENT_ID || null,
        docsUrl: 'https://www.phone.email/docs-sign-in-with-phone',
        message:
            'Use clientId for the Phone.Email button in WebView. Server holds PHONE_VERIFICATION_API_KEY; primary sign-in: POST /api/auth/phone-email/session with user_json_url.',
    });
});

/**
 * @swagger
 * /auth/phone-email/session:
 *   post:
 *     summary: Exchange Phone.Email `user_json_url` for a Supabase session (primary sign-in)
 *     description: |
 *       After OTP, Phone.Email invokes `phoneEmailListener` with `user_json_url` (see their docs — backend must GET JSON for
 *       phone + names). This is not Supabase SMS OTP. The server creates a Supabase **email** identity with a synthetic address
 *       (`pe.{digits}@…`) and returns `{ session, user, profile }` for `supabase.auth.setSession`.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_json_url
 *             properties:
 *               user_json_url:
 *                 type: string
 *                 format: uri
 *     responses:
 *       200:
 *         description: Session and profile
 *       400:
 *         description: Missing URL or invalid verification JSON
 *       401:
 *         description: Sign-in failed
 */
router.post('/phone-email/session', async (req: Request, res: Response) => {
    const user_json_url = req.body?.user_json_url;
    if (!user_json_url || typeof user_json_url !== 'string') {
        res.status(400).json({
            error: 'Bad Request',
            message: 'user_json_url is required in the request body',
            statusCode: 400,
        });
        return;
    }
    try {
        const result = await authService.createSessionFromPhoneEmailUserJson(user_json_url);
        res.send(result);
    } catch (error: any) {
        const status = getErrorHttpStatus(error);
        res.status(status).json({
            error: error.name || 'Internal Server Error',
            message: error.message || 'An unexpected error occurred',
            statusCode: status,
        });
    }
});

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
        const status = getErrorHttpStatus(error);
        res.status(status).json({
            error: error.name || 'Internal Server Error',
            message: error.message || 'An unexpected error occurred',
            statusCode: status,
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
        const status = getErrorHttpStatus(error);
        res.status(status).json({
            error: error.name || 'Internal Server Error',
            message: error.message || 'An unexpected error occurred',
            statusCode: status,
        });
    }
});

/**
 * @swagger
 * /auth/phone-email/sync-profile:
 *   post:
 *     summary: Sync profile from Phone.Email `user_json_url` (post–OTP success)
 *     description: |
 *       Backend-driven step from [Phone.Email docs](https://www.phone.email/docs-sign-in-with-phone): after the WebView
 *       returns `user_json_url` to your app, POST it here with the user's Supabase Bearer token. The server GETs the JSON
 *       (host allowlisted), reads `user_country_code`, `user_phone_number`, `user_first_name`, `user_last_name`, and upserts profile.
 *       Optional `full_name` in the body overrides the combined first + last name.
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
 *               - user_json_url
 *             properties:
 *               user_json_url:
 *                 type: string
 *                 format: uri
 *                 description: URL from Phone.Email phoneEmailListener (e.g. https://user.phone.email/user_….json)
 *               full_name:
 *                 type: string
 *                 description: Optional override for display name
 *     responses:
 *       200:
 *         description: Profile updated
 *       400:
 *         description: Invalid URL, fetch failure, or duplicate phone
 *       401:
 *         description: Unauthorized
 */
router.post('/phone-email/sync-profile', [authMiddleware], async (req: Request, res: Response) => {
    const authUser = (req as any)?.user;
    if (!authUser?.id) {
        res.status(401).json({
            error: 'Unauthorized',
            message: 'User context missing',
            statusCode: 401,
        });
        return;
    }

    const user_json_url = req.body?.user_json_url;
    if (!user_json_url || typeof user_json_url !== 'string') {
        res.status(400).json({
            error: 'Bad Request',
            message: 'user_json_url is required in the request body',
            statusCode: 400,
        });
        return;
    }

    try {
        const verified = await phoneVerificationService.fetchVerifiedUserFromPhoneEmailJson(user_json_url);
        const explicit =
            typeof req.body?.full_name === 'string' && req.body.full_name.trim() !== '' ? req.body.full_name : undefined;
        const full_name = formatProfileFullName({
            explicitFullName: explicit,
            firstName: verified.first_name,
            lastName: verified.last_name,
        });

        const profile = await userService.upsertProfileFromVerifiedPhone({
            userId: authUser.id,
            phone: verified.phone,
            full_name,
            email: authUser.email ?? undefined,
        });
        await chatService.ensureUserHasUsername(authUser.id);

        res.send({
            message: 'Profile synced from Phone.Email verification JSON',
            profile,
        });
    } catch (error: any) {
        const status = getErrorHttpStatus(error);
        res.status(status).json({
            error: error.name || 'Internal Server Error',
            message: error.message || 'An unexpected error occurred',
            statusCode: status,
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
 *       while merging `preferences.phone_verified` (document `verification_status` remains for ID/KYC). If the JWT includes `user_first_name` / `user_last_name` (or aliases),
 *       those are merged into `full_name` unless you pass `full_name` in the body.
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
    const phoneToken = req.body?.phoneToken ?? req.body?.token;
    if (!phoneToken || typeof phoneToken !== 'string') {
        res.status(400).json({
            error: 'Bad Request',
            message: 'phoneToken or token is required in the request body',
            statusCode: 400,
        });
        return;
    }
    try {
        const { phone, first_name, last_name } = phoneVerificationService.verifyPhoneToken(phoneToken);
        const explicit =
            typeof req.body?.full_name === 'string' && req.body.full_name.trim() !== '' ? req.body.full_name : undefined;
        const full_name = formatProfileFullName({
            explicitFullName: explicit,
            firstName: first_name,
            lastName: last_name,
        });
        const profile = await userService.upsertProfileFromVerifiedPhone({
            userId: authUser.id,
            phone,
            full_name,
            email: authUser.email ?? undefined,
        });
        await chatService.ensureUserHasUsername(authUser.id);

        res.send({
            message: 'Phone number verified successfully',
            profile,
        });
    } catch (error: any) {
        const status = getErrorHttpStatus(error);
        res.status(status).json({
            error: error.name || 'Internal Server Error',
            message: error.message || 'An unexpected error occurred',
            statusCode: status,
        });
    }
});

/**
 * @swagger
 * /auth/profile/phone:
 *   post:
 *     summary: Create or update profile using a verified phone (OTP / webview flow)
 *     description: |
 *       For users who sign in with phone via Supabase (e.g. webview OTP): after the backend-driven verification
 *       provider returns a signed `phoneToken` (JWT), call this with the Supabase session bearer token to persist
 *       the phone on `users` / `user_profiles`, merge `preferences` phone-verification flags, and optionally set `full_name`.
 *       Same user logging in again can call repeatedly (idempotent). If the phone is already tied to another account,
 *       returns 400. When the Auth user has a phone, it must match the JWT (digits), so the same number used in-app is required.
 *       JWT may include first/last name claims (`user_first_name` / `user_last_name`); optional body `full_name` overrides.
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
 *               - phoneToken
 *             properties:
 *               phoneToken:
 *                 type: string
 *                 description: Signed JWT from the phone verification service (alias `token`)
 *               token:
 *                 type: string
 *                 description: Alias for phoneToken
 *               full_name:
 *                 type: string
 *                 description: Display name (optional; defaults to existing profile name or "User")
 *     responses:
 *       200:
 *         description: Profile saved
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
 *         description: Missing token, duplicate phone, or phone mismatch
 *       401:
 *         description: Unauthorized or invalid verification token
 */
router.post('/profile/phone', [authMiddleware], async (req: Request, res: Response) => {
    const authUser = (req as any)?.user;
    if (!authUser?.id) {
        res.status(401).json({
            error: 'Unauthorized',
            message: 'User context missing',
            statusCode: 401,
        });
        return;
    }

    const phoneToken = req.body?.phoneToken ?? req.body?.token;
    if (!phoneToken || typeof phoneToken !== 'string') {
        res.status(400).json({
            error: 'Bad Request',
            message: 'phoneToken or token is required in the request body',
            statusCode: 400,
        });
        return;
    }

    const rawName = req.body?.full_name;
    const full_name = typeof rawName === 'string' ? rawName : undefined;

    try {
        const { phone, first_name, last_name } = phoneVerificationService.verifyPhoneToken(phoneToken);
        const resolvedFullName = formatProfileFullName({
            explicitFullName: full_name,
            firstName: first_name,
            lastName: last_name,
        });
        const profile = await userService.upsertProfileFromVerifiedPhone({
            userId: authUser.id,
            phone,
            full_name: resolvedFullName,
            email: authUser.email ?? undefined,
        });
        await chatService.ensureUserHasUsername(authUser.id);

        res.send({
            message: 'Profile saved with verified phone',
            profile,
        });
    } catch (error: any) {
        const status = getErrorHttpStatus(error);
        res.status(status).json({
            error: error.name || 'Internal Server Error',
            message: error.message || 'An unexpected error occurred',
            statusCode: status,
        });
    }
});

export default router;
