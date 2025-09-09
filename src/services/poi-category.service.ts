import { SupabaseClient } from '@supabase/supabase-js';
import { getDB } from '../configuration/database.config';
import { IPOICategory } from '../interfaces/poi.interface';
import { BadRequestError, NotFoundError } from '@hyperflake/http-errors';

export class POICategoryService {
    private get db(): SupabaseClient {
        return getDB();
    }

    /**
     * @desc Get all POI categories
     */
    async getAllCategories(): Promise<IPOICategory[]> {
        const { data, error } = await this.db.from('poi_categories').select('*').order('name');
        if (error) throw new Error(error.message);
        return data as IPOICategory[];
    }

    /**
     * @desc Get category by ID
     */
    async getById(params: { categoryId: string }): Promise<IPOICategory> {
        const { categoryId } = params;
        return await this.getByIdOrThrowError({ categoryId });
    }

    /**
     * @desc Create a new POI category
     */
    async create(params: { name: string; icon?: string; color?: string; description?: string }): Promise<IPOICategory> {
        const { name, icon, color, description } = params;

        // Check if category already exists
        const { data: existing, error: existsError } = await this.db
            .from('poi_categories')
            .select('*')
            .eq('name', name)
            .maybeSingle();

        if (existsError) throw new Error(existsError.message);
        if (existing) throw new BadRequestError(`Category with name '${name}' already exists.`);

        const { data, error } = await this.db
            .from('poi_categories')
            .insert([{ name, icon, color, description }])
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data as IPOICategory;
    }

    /**
     * @desc Update a category
     */
    async update(params: {
        categoryId: string;
        name?: string;
        icon?: string;
        color?: string;
        description?: string;
    }): Promise<IPOICategory> {
        const { categoryId, ...payload } = params;

        // Verify exists
        await this.getByIdOrThrowError({ categoryId });

        const { data, error } = await this.db
            .from('poi_categories')
            .update(payload)
            .eq('id', categoryId)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data as IPOICategory;
    }

    /**
     * @desc Delete a category
     */
    async delete(params: { categoryId: string }): Promise<{ categoryId: string }> {
        const { categoryId } = params;

        // Verify exists
        await this.getByIdOrThrowError({ categoryId });

        const { error } = await this.db.from('poi_categories').delete().eq('id', categoryId);
        if (error) throw new Error(error.message);

        return { categoryId };
    }

    // ---------------------
    // PRIVATE UTILITIES
    // ---------------------
    private async getByIdOrThrowError(params: { categoryId: string }): Promise<IPOICategory> {
        const { categoryId } = params;
        const { data, error } = await this.db.from('poi_categories').select('*').eq('id', categoryId).maybeSingle();

        if (error) throw new Error(error.message);
        if (!data) throw new NotFoundError(`Category with id ${categoryId} not found.`);

        return data as IPOICategory;
    }
}
