import { SupabaseClient, User } from '@supabase/supabase-js';
import { getDB } from '../configuration/database.config';
import { BadRequestError, UnauthorizedError } from '@hyperflake/http-errors';
import { ChatService } from './chat.service';

export class AuthService {
    private get db(): SupabaseClient {
        return getDB();
    }

    /**
     * @desc Get Google OAuth URL for authentication
     */
    async getGoogleOAuthUrl(redirectTo?: string) {
        const redirectUrl =
            redirectTo || process.env.SUPABASE_REDIRECT_URL || 'http://localhost:3000/api/auth/callback';

        console.log('Generating Google OAuth URL, redirect to:', redirectUrl);

        // Supabase-js types don't yet expose flowType, so keep this object loosely typed.
        const oauthOptions: Record<string, any> = {
            redirectTo: redirectUrl,
            flowType: 'pkce',
            skipBrowserRedirect: true,
            queryParams: {
                access_type: 'offline',
                prompt: 'consent',
            },
        };

        const { data, error } = await this.db.auth.signInWithOAuth({
            provider: 'google',
            options: oauthOptions,
        });

        if (error) {
            console.error('Supabase OAuth URL generation error:', error);
            throw new BadRequestError(error.message);
        }

        console.log('Google OAuth URL generated successfully');
        return data;
    }

    /**
     * @desc Handle OAuth callback and exchange code for session
     * @param code - Authorization code from OAuth provider
     * @param codeVerifier - PKCE code verifier (if using PKCE)
     */
    async handleOAuthCallback(code: string) {
        console.log('Handling OAuth callback with code');

        try {
            // Exchange the code for a session
            const { data, error } = await this.db.auth.exchangeCodeForSession(code);

            if (error) {
                console.error('OAuth callback error:', error);
                throw new UnauthorizedError(error.message);
            }

            if (!data.session || !data.user) {
                throw new UnauthorizedError('Failed to create session');
            }

            console.log('OAuth callback successful, user ID:', data.user.id);

            await this.syncUserProfile(data.user);

            console.log('User profile setup completed');
            return data;
        } catch (error) {
            console.error('OAuth callback error:', error);
            throw error;
        }
    }

    async handleOAuthTokenResponse(params: {
        accessToken: string;
        refreshToken?: string;
        expiresIn?: number;
        expiresAt?: number;
        tokenType?: string;
        providerToken?: string;
        providerRefreshToken?: string;
    }) {
        console.log('Handling OAuth response via fragment tokens');

        const { accessToken, refreshToken, expiresIn, expiresAt, tokenType, providerToken, providerRefreshToken } =
            params;

        const { data, error } = await this.db.auth.getUser(accessToken);
        if (error || !data.user) {
            console.error('Failed to fetch user from access token:', error);
            throw new UnauthorizedError('Invalid access token received');
        }

        await this.syncUserProfile(data.user);

        const nowSeconds = Math.floor(Date.now() / 1000);
        const computedExpiry = expiresAt || (expiresIn ? nowSeconds + expiresIn : nowSeconds + 3600);

        return {
            user: data.user,
            session: {
                access_token: accessToken,
                token_type: tokenType || 'bearer',
                expires_in: expiresIn || 3600,
                expires_at: computedExpiry,
                refresh_token: refreshToken || null,
                provider_token: providerToken || null,
                provider_refresh_token: providerRefreshToken || null,
            },
        };
    }

    /**
     * @desc Verify Supabase token for protected endpoints
     */
    async verifyToken(token: string) {
        const { data, error } = await this.db.auth.getUser(token);
        if (error || !data.user) throw new UnauthorizedError('Invalid token');
        return data.user;
    }

    /**
     * @desc Logout user
     */
    async logout() {
        const { error } = await this.db.auth.signOut();
        if (error) throw new BadRequestError(error.message);
    }

    private async syncUserProfile(user: User) {
        const userId = user.id;
        const email = user.email;
        const fullName =
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.user_metadata?.display_name ||
            user.user_metadata?.preferred_username ||
            'User';
        const phone = user.user_metadata?.phone || null;

        if (!userId) {
            throw new BadRequestError('User ID missing from auth payload');
        }

        await this.db
            .from('users')
            .upsert({ id: userId, phone: phone || null, email })
            .select('id');

        await this.db
            .from('user_profiles')
            .upsert({ id: userId, full_name: fullName, phone: phone || null, email })
            .select('id');

        const chatService = new ChatService();
        await chatService.ensureUserHasUsername(userId);
    }
}
