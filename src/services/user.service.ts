import { SupabaseClient } from '@supabase/supabase-js';
import { IUser } from '../interfaces/user.interface';
import { BadRequestError, NotFoundError } from '@hyperflake/http-errors';
import { getDB } from '../configuration/database.config';

export class UserService {
    // Always fetch DB lazily
    private get db(): SupabaseClient {
        return getDB();
    }

    /**
     * @desc Get all users
     */
    async getAllUsers(): Promise<IUser[]> {
        const { data, error } = await this.db.from('users').select('*');
        if (error) throw new Error(error.message);
        return data as IUser[];
    }

    /**
     * @desc Get a user by ID
     */
    async getById(params: { userId: string }): Promise<IUser> {
        const { userId } = params;
        return await this.getByIdOrThrowError({ userId });
    }

    /**
     * @desc Create a new user
     */
    async create(params: { name: string; email: string; password: string }): Promise<IUser> {
        const { name, email, password } = params;

        // Check if email already exists
        const { data: existing, error: existsError } = await this.db
            .from('users')
            .select('*')
            .eq('email', email)
            .maybeSingle();

        if (existsError) throw new Error(existsError.message);
        if (existing) throw new BadRequestError(`User with email ${email} already exists.`);

        const { data, error } = await this.db.from('users').insert([{ name, email, password }]).select().single();

        if (error) throw new Error(error.message);
        return data as IUser;
    }

    /**
     * @desc Update a user
     */
    async update(params: { userId: string; name?: string; email?: string; password?: string }): Promise<IUser> {
        const { userId, ...payload } = params;

        // Verify user exists
        await this.getByIdOrThrowError({ userId });

        const { data, error } = await this.db.from('users').update(payload).eq('id', userId).select().single();
        if (error) throw new Error(error.message);
        return data as IUser;
    }

    /**
     * @desc Soft delete a user
     */
    async delete(params: { userId: string }): Promise<{ userId: string }> {
        const { userId } = params;

        // Verify user exists
        await this.getByIdOrThrowError({ userId });

        const { error } = await this.db.from('users').delete().eq('id', userId);
        if (error) throw new Error(error.message);

        return { userId };
    }

    // ---------------------
    // PRIVATE UTILITIES
    // ---------------------
    private async getByIdOrThrowError(params: { userId: string }): Promise<IUser> {
        const { userId } = params;
        const { data, error } = await this.db.from('users').select('*').eq('id', userId).maybeSingle();

        if (error) throw new Error(error.message);
        if (!data) throw new NotFoundError(`User with id ${userId} not found.`);

        return data as IUser;
    }
}
