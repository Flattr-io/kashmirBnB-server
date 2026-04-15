import { randomBytes } from 'node:crypto';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { getDB } from '../configuration/database.config';
import { BadRequestError, UnauthorizedError } from '@hyperflake/http-errors';
import { formatProfileFullName } from '../constants/user-profile.schema';
import { ChatService } from './chat.service';
import { PhoneVerificationService } from './phone-verification.service';
import { UserService } from './user.service';

export class AuthService {
    private get db(): SupabaseClient {
        return getDB();
    }

    /**
     * @desc Get Google OAuth URL for authentication
     */
    async getGoogleOAuthUrl() {
        const redirectUrl = process.env.SUPABASE_REDIRECT_URL || 'http://localhost:3000/api/auth/callback';

        console.log('Generating Google OAuth URL, redirect to:', redirectUrl);

        const { data, error } = await this.db.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUrl,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                },
            },
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

    async signInWithGoogleIdToken(idToken: string, nonce?: string) {
        console.log('Signing in with Google ID token');

        const { data, error } = await this.db.auth.signInWithIdToken({
            provider: 'google',
            token: idToken,
            nonce,
        });

        if (error) {
            console.error('Failed to sign in with Google ID token:', error);
            throw new UnauthorizedError(error.message);
        }

        if (!data.session || !data.user) {
            throw new UnauthorizedError('Failed to create session from ID token');
        }

        await this.syncUserProfile(data.user);

        console.log('Google ID token sign-in successful, user ID:', data.user.id);
        return data;
    }

    /**
     * Phone.Email primary sign-in (see https://www.phone.email/docs-sign-in-with-phone — backend reads `user_json_url`).
     * OTP is completed in Phone.Email’s flow, not Supabase SMS. We do not use `signInWithOtp` / Twilio on Supabase.
     *
     * After fetching verified phone + names from their JSON, we create or sign in a Supabase user using a **synthetic email**
     * (`pe.{digits}@…`) plus a server-only password, then issue a normal session. Real phone lives in `user_profiles.phone`.
     */
    async createSessionFromPhoneEmailUserJson(userJsonUrl: string) {
        const phoneVerificationService = new PhoneVerificationService();
        const userService = new UserService();

        const verified = await phoneVerificationService.fetchVerifiedUserFromPhoneEmailJson(userJsonUrl);
        const full_name = formatProfileFullName({
            firstName: verified.first_name,
            lastName: verified.last_name,
        });
        const phoneDisplay = verified.phone.trim();
        const syntheticEmail = buildPhoneEmailSyntheticLoginEmail(phoneDisplay);
        const tempPassword = randomBytes(32).toString('base64url');

        /**
         * `create_user_profile` trigger copies `raw_user_meta_data->>'phone'` into `public.users.phone`.
         * Older DBs use VARCHAR(15) for that column; E.164 with `+` can exceed 15 chars and makes Auth return
         * "Database error creating new user". Store up to 15 **digits** (E.164 max) — full display/E.164 is set in `user_profiles` by `upsertProfileFromVerifiedPhone`.
         */
        const phoneForAuthMetadata = digitsOnly(phoneDisplay).slice(0, 15);

        const { data: created, error: createError } = await this.db.auth.admin.createUser({
            email: syntheticEmail,
            password: tempPassword,
            email_confirm: true,
            user_metadata: {
                full_name,
                phone: phoneForAuthMetadata,
                phone_e164: phoneDisplay,
                phone_verified_by: 'phone.email',
            },
        });

        let userId: string | null = created?.user?.id ?? null;

        if (createError) {
            if (!isLikelyDuplicateAuthUserError(createError)) {
                console.error('[PhoneEmailSession] createUser:', createError);
                throw new BadRequestError(
                    authAdminErrorMessage(createError) || 'Could not create sign-in for this phone number'
                );
            }
            userId = await this.resolveExistingUserIdForPhoneEmailSession(phoneDisplay, syntheticEmail);
            if (!userId) {
                console.error('[PhoneEmailSession] duplicate-like createUser error but no existing user match:', createError);
                throw new BadRequestError(
                    authAdminErrorMessage(createError) ||
                        'This phone number is already registered but could not be linked. Please contact support.'
                );
            }
            const { error: updErr } = await this.db.auth.admin.updateUserById(userId, {
                password: tempPassword,
            });
            if (updErr) {
                console.error('[PhoneEmailSession] updateUserById:', updErr);
                throw new BadRequestError(updErr.message || 'Could not refresh sign-in for this phone number');
            }
        }

        if (!userId) {
            throw new BadRequestError('Sign-in could not be established for this phone number');
        }

        /**
         * Do not call `signInWithPassword` on the shared `getDB()` client: it attaches the user's JWT to that
         * client, so subsequent `from('users')` / PostgREST calls run as `authenticated` and RLS applies
         * (your `users` table has no INSERT policy). Use a short-lived client so the singleton keeps using the
         * service role only — see https://supabase.com/docs/guides/database/postgres/row-level-security
         */
        const { data: signInData, error: signInError } = await this.signInWithPasswordOnEphemeralClient(
            syntheticEmail,
            tempPassword
        );

        if (signInError || !signInData.session || !signInData.user) {
            console.error('[PhoneEmailSession] signInWithPassword:', signInError);
            throw new UnauthorizedError(signInError?.message || 'Sign-in failed after Phone.Email verification');
        }

        await this.rotateUserPasswordOpaque(userId);

        await this.syncUserProfile(signInData.user);

        const profile = await userService.upsertProfileFromVerifiedPhone({
            userId,
            phone: phoneDisplay,
            full_name,
            email: syntheticEmail,
        });
        const chatService = new ChatService();
        await chatService.ensureUserHasUsername(userId);

        return {
            session: signInData.session,
            user: signInData.user,
            profile,
        };
    }

    /**
     * Isolated client so the process-wide service client never stores an end-user session (RLS would apply).
     */
    private signInWithPasswordOnEphemeralClient(email: string, password: string) {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !key) {
            throw new BadRequestError('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured');
        }
        const isolated = createClient(url, key, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
        });
        return isolated.auth.signInWithPassword({ email, password });
    }

    private async rotateUserPasswordOpaque(userId: string): Promise<void> {
        const next = randomBytes(48).toString('base64url');
        const { error } = await this.db.auth.admin.updateUserById(userId, { password: next });
        if (error) {
            console.warn('[PhoneEmailSession] password rotation skipped:', error.message);
        }
    }

    /**
     * Existing account: synthetic email on `public.users`, profile phone, or legacy Supabase `auth.users.phone` rows.
     */
    private async resolveExistingUserIdForPhoneEmailSession(
        rawPhone: string,
        syntheticEmail: string
    ): Promise<string | null> {
        const byAuthEmail = await this.findAuthUserIdByEmail(syntheticEmail);
        if (byAuthEmail) return byAuthEmail;

        const bySynth = await this.findUserIdBySyntheticEmail(syntheticEmail);
        if (bySynth) return bySynth;

        const trimmed = rawPhone.trim();
        const phoneKey = digitsOnly(trimmed).slice(0, 15);
        const phoneVariants = [...new Set([trimmed, phoneKey].filter((p) => p.length > 0))];

        const { data: byProfileRows } = await this.db
            .from('user_profiles')
            .select('id')
            .in('phone', phoneVariants)
            .limit(1);
        const byProfile = byProfileRows?.[0];
        if (byProfile?.id) {
            return byProfile.id as string;
        }

        const { data: byUsersRows } = await this.db
            .from('users')
            .select('id')
            .in('phone', phoneVariants)
            .limit(1);
        const byUsersTable = byUsersRows?.[0];
        if (byUsersTable?.id) {
            return byUsersTable.id as string;
        }

        const targetDigits = digitsOnly(trimmed);
        return await this.findAuthUserIdByPhoneDigits(targetDigits);
    }

    private async findUserIdBySyntheticEmail(syntheticEmail: string): Promise<string | null> {
        const { data } = await this.db.from('users').select('id').eq('email', syntheticEmail).maybeSingle();
        return data?.id ? (data.id as string) : null;
    }

    private async findAuthUserIdByPhoneDigits(targetDigits: string): Promise<string | null> {
        if (targetDigits.length < 8) return null;
        const perPage = 1000;
        let page = 1;
        let lastPage = 1;
        const maxPages = 100;

        while (page <= lastPage && page <= maxPages) {
            const { data, error } = await this.db.auth.admin.listUsers({ page, perPage });
            if (error) {
                console.error('[PhoneEmailSession] listUsers:', error);
                return null;
            }
            const users = data?.users ?? [];
            const lp = (data as { lastPage?: number })?.lastPage;
            if (typeof lp === 'number' && lp > 0) {
                lastPage = lp;
            }
            for (const u of users) {
                if (authUserPhoneDigitsMatch(u, targetDigits)) {
                    return u.id;
                }
            }
            if (users.length < perPage) break;
            page += 1;
        }
        return null;
    }

    private async findAuthUserIdByEmail(targetEmail: string): Promise<string | null> {
        const normalized = targetEmail.trim().toLowerCase();
        if (!normalized) return null;

        const perPage = 1000;
        let page = 1;
        let lastPage = 1;
        const maxPages = 100;

        while (page <= lastPage && page <= maxPages) {
            const { data, error } = await this.db.auth.admin.listUsers({ page, perPage });
            if (error) {
                console.error('[PhoneEmailSession] listUsers(email):', error);
                return null;
            }
            const users = data?.users ?? [];
            const lp = (data as { lastPage?: number })?.lastPage;
            if (typeof lp === 'number' && lp > 0) {
                lastPage = lp;
            }
            for (const u of users) {
                if ((u.email || '').trim().toLowerCase() === normalized) {
                    return u.id;
                }
            }
            if (users.length < perPage) break;
            page += 1;
        }
        return null;
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
        const metadata = user.user_metadata || {};
        const email = user.email || metadata.email || null;
        const fullName =
            metadata.full_name ||
            metadata.name ||
            metadata.display_name ||
            metadata.preferred_username ||
            'User';
        const avatarUrlRaw =
            metadata.avatar_url ||
            metadata.avatarUrl ||
            metadata.picture ||
            metadata.image ||
            metadata.profile_image ||
            metadata.profile_image_url ||
            null;
        const avatarUrl =
            typeof avatarUrlRaw === 'string' && avatarUrlRaw.trim().length > 0 ? avatarUrlRaw.trim() : null;

        if (!userId) {
            throw new BadRequestError('User ID missing from auth payload');
        }

        await this.db
            .from('users')
            .upsert({ id: userId, email })
            .select('id');

        const profilePayload: { id: string; full_name: string; email?: string | null; avatar_url?: string } = {
            id: userId,
            full_name: fullName,
            email,
        };
        if (avatarUrl) {
            profilePayload.avatar_url = avatarUrl;
        }

        await this.db.from('user_profiles').upsert(profilePayload).select('id');

        const chatService = new ChatService();
        await chatService.ensureUserHasUsername(userId);
    }
}

/**
 * Deterministic login identifier — not a mailbox. RFC 2606-style TLD by default.
 * Phone.Email verification is the source of truth for the real number (`user_profiles.phone`).
 */
function buildPhoneEmailSyntheticLoginEmail(verifiedPhoneCombined: string): string {
    const domain =
        process.env.PHONE_EMAIL_SYNTHETIC_EMAIL_DOMAIN?.trim() || 'phone-email.verified.invalid';
    const digits = digitsOnly(verifiedPhoneCombined);
    if (!digits || digits.length < 8) {
        throw new BadRequestError('Invalid phone number from Phone.Email verification JSON');
    }
    return `pe.${digits}@${domain}`;
}

function digitsOnly(s: string): string {
    return s.replace(/\D/g, '');
}

function authAdminErrorMessage(err: unknown): string {
    if (err == null) return '';
    if (typeof err === 'string') return err.trim();
    const o = err as Record<string, unknown>;
    const msg = o.message ?? o.msg ?? o.error_description;
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
    try {
        return JSON.stringify(err);
    } catch {
        return String(err);
    }
}

function isLikelyDuplicateAuthUserError(err: unknown): boolean {
    const code = String((err as { code?: string })?.code || '')
        .toLowerCase()
        .trim();
    if (
        code === 'identity_already_exists' ||
        code === 'user_already_exists' ||
        code === 'email_exists' ||
        code === 'phone_exists'
    ) {
        return true;
    }

    const m = authAdminErrorMessage(err).toLowerCase();
    if (!m) return false;

    if (m.includes('already been registered')) return true;
    if (m.includes('email address has already been registered')) return true;
    if (m.includes('phone number has already been registered')) return true;
    if (m.includes('user already registered')) return true;
    if (m.includes('a user with this email address has already been registered')) return true;

    return false;
}

function authUserPhoneDigitsMatch(user: User, targetDigits: string): boolean {
    const meta = user.user_metadata;
    const fromMeta =
        meta && typeof meta === 'object' && !Array.isArray(meta)
            ? [
                  (meta as Record<string, unknown>).phone,
                  (meta as Record<string, unknown>).phone_e164,
                  (meta as Record<string, unknown>).phone_number,
              ]
            : [];
    const candidates = [user.phone, ...fromMeta];
    for (const c of candidates) {
        if (typeof c === 'string' && c.length > 0 && digitsOnly(c) === targetDigits) {
            return true;
        }
    }
    return false;
}
