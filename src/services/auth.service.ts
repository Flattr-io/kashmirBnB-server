import { SupabaseClient } from '@supabase/supabase-js';
import { getDB } from '../configuration/database.config';
import { BadRequestError, UnauthorizedError } from '@hyperflake/http-errors';
import { ChatService } from './chat.service';

export class AuthService {
    private get db(): SupabaseClient {
        return getDB();
    }

    /**
     * @desc Sign up a new user (Supabase Auth handles password hashing)
     */
    async signUp(params: { email: string; password: string; name?: string; fullName?: string; phone?: string }) {
        const { email, password } = params;
        const fullName = (params.fullName || params.name || '').trim();
        const phone = (params.phone || '').trim();

        console.log('Attempting signup for:', email);

        try {
            const { data, error } = await this.db.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName || undefined,
                        phone: phone || undefined
                    }
                }
            });

            if (error) {
                console.error('Supabase auth signup error:', error);
                // If user already exists, try to sign them in instead
                if (error.message.includes('already registered') || error.message.includes('User already registered')) {
                    console.log('User already exists, attempting login...');
                    const loginResult = await this.login({ email, password });
                    return loginResult;
                }
                throw new BadRequestError(error.message);
            }

            console.log('Auth signup successful, user ID:', data.user?.id);

            const userId = data.user?.id;
            if (userId) {
                // 1) Upsert public.users with phone/email (id is FK to auth.users)
                await this.db.from('users').upsert({ id: userId, phone: phone || null, email }).select('id');

                // 2) Upsert user_profiles with defaults { full_name, phone, email }
                await this.db
                    .from('user_profiles')
                    .upsert({ id: userId, full_name: fullName || 'User', phone: phone || null, email })
                    .select('id');

                // 3) Ensure chat_username exists
                const chatService = new ChatService();
                await chatService.ensureUserHasUsername(userId);
            }

            console.log('Signup completed successfully');
            return data;

        } catch (error) {
            console.error('Signup error:', error);
            throw error;
        }
    }

    /**
     * @desc Login user and return session (JWT included)
     */
    async login(params: { email: string; password: string }) {
        const { email, password } = params;

        console.log('Attempting login for:', email);

        const { data, error } = await this.db.auth.signInWithPassword({
            email,
            password,
        });

        

        if (error) throw new UnauthorizedError(error.message);

        return data; // Contains user and access_token
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
}

