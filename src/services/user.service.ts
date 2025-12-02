import { SupabaseClient } from '@supabase/supabase-js';
import { IUser } from '../interfaces/user.interface';
import { IUserProfile } from '../interfaces/user-profile.interface';
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

    /**
     * @desc Get the profile information for a specific user
     */
    async getProfileByUserId(userId: string): Promise<IUserProfile> {
        const { data, error } = await this.db.from('user_profiles').select('*').eq('id', userId).maybeSingle();

        if (error) throw new Error(error.message);
        if (!data) throw new NotFoundError(`Profile for user ${userId} not found.`);

        const normalizedProfile: IUserProfile = {
            ...data,
            verification_status: data.verification_status ?? 'unverified',
            kyc_status: data.kyc_status ?? 'pending',
            dob: data.dob ?? null,
            gender: data.gender ?? null,
        };

        return normalizedProfile;
    }

    /**
     * @desc Update a user's profile
     */
    async updateProfile(params: {
        userId: string;
        full_name?: string;
        avatar_url?: string;
        bio?: string;
        location?: string;
        phone?: string;
        email?: string;
        date_of_birth?: string;
        gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
        nationality?: string;
        emergency_contact?: any;
        preferences?: any;
        verification_status?: 'unverified' | 'pending' | 'verified' | 'rejected';
        verification_documents?: any;
        is_active?: boolean;
        online_status?: 'online' | 'offline' | 'away' | 'busy';
    }): Promise<IUserProfile> {
        const { userId, ...payload } = params;

        // Verify profile exists
        await this.getProfileByUserId(userId);

        // Validate verification_status if provided
        if (payload.verification_status !== undefined) {
            const validStatuses = ['unverified', 'pending', 'verified', 'rejected'];
            if (!validStatuses.includes(payload.verification_status)) {
                throw new BadRequestError(
                    `Invalid verification_status. Must be one of: ${validStatuses.join(', ')}`
                );
            }
        }

        // Validate gender if provided
        if (payload.gender !== undefined) {
            const validGenders = ['male', 'female', 'other', 'prefer_not_to_say'];
            if (!validGenders.includes(payload.gender)) {
                throw new BadRequestError(`Invalid gender. Must be one of: ${validGenders.join(', ')}`);
            }
        }

        // Validate online_status if provided
        if (payload.online_status !== undefined) {
            const validStatuses = ['online', 'offline', 'away', 'busy'];
            if (!validStatuses.includes(payload.online_status)) {
                throw new BadRequestError(`Invalid online_status. Must be one of: ${validStatuses.join(', ')}`);
            }
        }

        // Validate phone length if provided
        if (payload.phone !== undefined && payload.phone !== null && payload.phone.length > 15) {
            throw new BadRequestError('Phone number must be 15 characters or less');
        }

        // Check for duplicate phone number if phone is being updated
        if (payload.phone !== undefined && payload.phone !== null && payload.phone.trim() !== '') {
            const { data: existingUser, error: checkError } = await this.db
                .from('users')
                .select('id')
                .eq('phone', payload.phone)
                .neq('id', userId)
                .maybeSingle();

            if (checkError) throw new Error(checkError.message);
            if (existingUser) {
                throw new BadRequestError('This phone number is already registered to another account');
            }
        }

        // Update user_profiles
        const { data, error } = await this.db
            .from('user_profiles')
            .update(payload)
            .eq('id', userId)
            .select()
            .single();

        if (error) {
            // Handle unique constraint violations
            if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('unique constraint')) {
                throw new BadRequestError('This phone number is already registered to another account');
            }
            throw new Error(error.message);
        }
        if (!data) throw new NotFoundError(`Profile for user ${userId} not found after update.`);

        // Sync phone and email to users table if they were updated
        if (payload.phone !== undefined || payload.email !== undefined) {
            const usersUpdatePayload: { phone?: string | null; email?: string | null } = {};
            if (payload.phone !== undefined) {
                usersUpdatePayload.phone = payload.phone || null;
            }
            if (payload.email !== undefined) {
                usersUpdatePayload.email = payload.email || null;
            }

            const { error: usersUpdateError } = await this.db
                .from('users')
                .update(usersUpdatePayload)
                .eq('id', userId);

            if (usersUpdateError) {
                // Handle unique constraint violations for users table
                if (
                    usersUpdateError.code === '23505' ||
                    usersUpdateError.message?.includes('duplicate key') ||
                    usersUpdateError.message?.includes('unique constraint')
                ) {
                    throw new BadRequestError('This phone number is already registered to another account');
                }
                throw new Error(usersUpdateError.message);
            }
        }

        const normalizedProfile: IUserProfile = {
            ...data,
            verification_status: data.verification_status ?? 'unverified',
            kyc_status: data.kyc_status ?? 'pending',
            dob: data.dob ?? null,
            gender: data.gender ?? null,
        };

        return normalizedProfile;
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
