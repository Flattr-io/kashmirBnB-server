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
        return data as IPOI[];
    }

    /**
     * @desc Get a POI by ID
     */
    async getById(params: { poiId: string }): Promise<IPOI> {
        const { poiId } = params;
        return await this.getByIdOrThrowError({ poiId });
    }

    /**
     * @desc Create a new POI
     */
    async create(params: ICreatePOIRequest & { created_by: string }): Promise<IPOI> {
        const { name, category_id, latitude, longitude, destination_id, min_zoom, max_zoom, priority, created_by } =
            params;

        // Validate zoom range
        if (min_zoom && max_zoom && min_zoom > max_zoom) {
            throw new BadRequestError('min_zoom cannot be greater than max_zoom.');
        }

        // Optional: check for duplicate POI with same name + category in destination
        const { data: existing, error: existsError } = await this.db
            .from('pois')
            .select('*')
            .eq('name', name)
            .eq('category_id', category_id)
            .eq('destination_id', destination_id)
            .maybeSingle();

        if (existsError) throw new Error(existsError.message);
        if (existing) {
            throw new BadRequestError(`POI "${name}" already exists in this category for this destination.`);
        }

        const { data, error } = await this.db
            .from('pois')
            .insert([
                { name, category_id, latitude, longitude, destination_id, min_zoom, max_zoom, priority, created_by },
            ])
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data as IPOI;
    }

    /**
     * @desc Update an existing POI
     */
    async update(params: { poiId: string } & IUpdatePOIRequest): Promise<IPOI> {
        const { poiId, ...payload } = params;

        // Validate zoom range
        if (payload.min_zoom && payload.max_zoom && payload.min_zoom > payload.max_zoom) {
            throw new BadRequestError('min_zoom cannot be greater than max_zoom.');
        }

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

    /**
     * @desc Get POIs by destination + zoom level
     *        Prioritized results for map rendering
     */
    async getByDestinationAndZoom(params: { destinationId: string; zoom: number; limit?: number }): Promise<IPOI[]> {
        const { destinationId, zoom, limit = 50 } = params;

        const { data, error } = await this.db
            .from('pois')
            .select('*')
            .eq('destination_id', destinationId)
            .eq('is_active', true)
            .lte('min_zoom', zoom)
            .gte('max_zoom', zoom)
            .order('priority', { ascending: false })
            .order('average_rating', { ascending: false })
            .limit(limit);

        if (error) throw new Error(error.message);
        return data as IPOI[];
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
