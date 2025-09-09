import { SupabaseClient } from '@supabase/supabase-js';
import { getDB } from '../configuration/database.config';
import { BadRequestError, NotFoundError } from '@hyperflake/http-errors';
import { IPOI, ICreatePOIRequest, IUpdatePOIRequest } from '../interfaces/poi.interface';

export class PoiService {
    private get db(): SupabaseClient {
        return getDB();
    }

    /**
     * @desc Get all POIs
     */
    async getAll(): Promise<IPOI[]> {
        const { data, error } = await this.db.from('pois').select('*');
        if (error) throw new Error(error.message);
        return data;
    }

    /**
     * @desc Get a POI by ID
     */
    async getById(params: { poiId: string }) {
        const { poiId } = params;
        return await this.getByIdOrThrowError({ poiId });
    }

    /**
     * @desc Create a new POI
     */
    async create(params: ICreatePOIRequest & { created_by: string }): Promise<IPOI> {
        const { name, category_id, latitude, longitude, created_by } = params;

        // Optional: check for duplicate POI with same name + category
        const { data: existing, error: existsError } = await this.db
            .from('pois')
            .select('*')
            .eq('name', name)
            .eq('category_id', category_id)
            .maybeSingle();

        if (existsError) throw new Error(existsError.message);
        if (existing) throw new BadRequestError(`POI with name "${name}" already exists in this category.`);

        const { data, error } = await this.db
            .from('pois')
            .insert([{ name, category_id, latitude, longitude, created_by }])
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data as IPOI;
    }

    /**
     * @desc Update an existing POI
     */
    async update(params: { poiId: string & IUpdatePOIRequest }): Promise<IPOI> {
        const { poiId, ...payload } = params;

        await this.getByIdOrThrowError({ poiId });

        const { data, error } = await this.db.from('pois').update(payload).eq('id', poiId).select().single();

        if (error) throw new Error(error.message);
        return data as IPOI;
    }

    /**
     * @desc Delete a POI
     */
    async delete(params: { poiId: string }): Promise<{ poiId: string }> {
        const { poiId } = params;

        // Verify POI exists
        await this.getByIdOrThrowError({ poiId });

        const { error } = await this.db.from('pois').delete().eq('id', poiId);
        if (error) throw new Error(error.message);

        return { poiId };
    }

    // ---------------------
    // PRIVATE UTILITIES
    // ---------------------
    private async getByIdOrThrowError(params: { poiId: string }): Promise<IPOI> {
        const { poiId } = params;
        const { data, error } = await this.db.from('pois').select('*').eq('id', poiId).maybeSingle();

        if (error) throw new Error(error.message);
        if (!data) throw new NotFoundError(`POI with id ${poiId} not found.`);

        return data as IPOI;
    }
}
