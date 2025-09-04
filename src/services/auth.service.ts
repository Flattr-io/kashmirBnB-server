import { SupabaseClient } from '@supabase/supabase-js';
import { getDB } from '../configuration/database.config';
import { BadRequestError, UnauthorizedError } from '@hyperflake/http-errors';

export class AuthService {
    private get db(): SupabaseClient {
        return getDB();
    }

    /**
     * @desc Sign up a new user (Supabase Auth handles password hashing)
     */
    async signUp(params: { email: string; password: string; name: string }) {
        const { email, password, name } = params;

        const { data, error } = await this.db.auth.signUp({
            email,
            password,
        });

        if (error) throw new BadRequestError(error.message);

        await this.db.from('users').insert([{ id: data.user?.id, name, email }]);

        return data;
    }

    /**
     * @desc Login user and return session (JWT included)
     */
    async login(params: { email: string; password: string }) {
        const { email, password } = params;

        console.log('Attempting login for:', email, password);

        const { data, error } = await this.db.auth.signInWithPassword({
            email,
            password,
        });

        console.log('Login response:', data, error);

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
