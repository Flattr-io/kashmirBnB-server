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
        // Join category table and embed as object; also return denormalized category_name
        const { data, error } = await this.db
            .from('pois')
            .select('*, category:poi_categories!inner(id, name, icon, color, description, created_at)');
        if (error) throw new Error(error.message);
        return data as unknown as IPOI[];
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
            .select('*, category:poi_categories!inner(id, name, icon, color, description, created_at)')
            .eq('destination_id', destinationId)
            .eq('is_active', true)
            .lte('min_zoom', zoom)
            .gte('max_zoom', zoom)
            .order('priority', { ascending: false })
            .order('average_rating', { ascending: false })
            .limit(limit);

        if (error) throw new Error(error.message);
        return data as unknown as IPOI[];
    }

    /**
     * @desc Get visit counts for specific POIs based on booked packages
     */
    async getPoiVisitCounts(poiIds: string[]): Promise<Record<string, number>> {
        if (!poiIds || poiIds.length === 0) return {};

        // Fetch all activity entries that match the POI list and belong to BOOKED packages
        // Chain: package_day_activities -> package_days -> packages (filter status=booked)
        const { data, error } = await this.db
            .from('package_day_activities')
            .select(`
                poi_id,
                package_days!inner(
                    packages!inner(booking_status)
                )
            `)
            .in('poi_id', poiIds)
            .eq('package_days.packages.booking_status', 'booked');

        if (error) {
            console.error('[PoiService] Failed to fetch stats:', error.message);
            throw new Error('Failed to fetch POI stats');
        }

        // Aggregate in memory
        const counts: Record<string, number> = {};
        
        // Initialize 0 for requested IDs
        poiIds.forEach(id => counts[id] = 0);

        (data || []).forEach((row: any) => {
            if (row.poi_id) {
                // Double check status just in case (though inner join filters it)
                // The Type assertion might be needed depending on generated types, but runtime check is safe
                const status = row.package_days?.packages?.booking_status;
                if (status === 'booked') {
                    counts[row.poi_id] = (counts[row.poi_id] || 0) + 1;
                }
            }
        });

        return counts;
    }

    // ---------------------
    // PRIVATE UTILITIES
    // ---------------------
    private async getByIdOrThrowError(params: { poiId: string }): Promise<IPOI> {
        const { poiId } = params;
        const { data, error } = await this.db
            .from('pois')
            .select('*, category:poi_categories!inner(id, name, icon, color, description, created_at)')
            .eq('id', poiId)
            .maybeSingle();

        if (error) throw new Error(error.message);
        if (!data) throw new NotFoundError(`POI with id ${poiId} not found.`);

        return data as unknown as IPOI;
    }
}
