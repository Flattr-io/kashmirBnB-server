import { SupabaseClient } from '@supabase/supabase-js';
import { getDB } from '../configuration/database.config';
import { NotFoundError, BadRequestError } from '@hyperflake/http-errors';
import {
    ICreateDestinationRequest,
    IUpdateDestinationRequest,
    IDestination,
    RowWithGeoJSON,
} from '../interfaces/destination.interface';

export class DestinationService {
    private get db(): SupabaseClient {
        return getDB();
    }

    /**
     * @desc Get all destinations
     */
    async getAll(): Promise<IDestination[]> {
        try {
            const { data, error } = await this.db
                .from('vw_destinations_public')
                .select(
                    `
                    id,
                    name,
                    slug,
                    metadata,
                    created_by,
                    created_at,
                    updated_at,
                    center_lat,
                    center_lng,
                    base_price,
                    area_geojson,
                    center_geojson
                `
                )
                .returns<RowWithGeoJSON[]>();

            if (error) {
                // If PostGIS functions are not available, try without them
                if (error.message.includes('ST_AsGeoJSON') || error.message.includes('relationship')) {
                    const { data: simpleData, error: simpleError } = await this.db
                        .from('vw_destinations_public')
                        .select(
                            `
                            id,
                            name,
                            slug,
                            metadata,
                            created_by,
                            created_at,
                            updated_at,
                            center_lat,
                            center_lng
                        `
                        );

                    if (simpleError) {
                        throw new BadRequestError(simpleError.message);
                    }

                    // Map simple data without GeoJSON
                    const destinations = simpleData.map((row: any) => ({
                        id: row.id,
                        name: row.name,
                        slug: row.slug,
                        area: null,
                        center: null,
                        center_lat: row.center_lat,
                        center_lng: row.center_lng,
                        base_price: Number(row.base_price ?? 0),
                        metadata: row.metadata ?? undefined,
                        created_by: row.created_by,
                        created_at: row.created_at,
                        updated_at: row.updated_at,
                    } as IDestination));

                    return destinations;
                }
                throw new BadRequestError(error.message);
            }

            const destinations = data.map((row) => this.mapRow(row));
            return destinations;
        } catch (error: any) {
            console.error('Error fetching destinations:', error);
            throw new BadRequestError(error.message);
        }
    }

    /**
     * @desc Get destination by ID
     */
    async getById(params: { destinationId: string }): Promise<IDestination> {
        const { destinationId } = params;
        const destination = await this.getByIdOrThrowError({ destinationId });
        return destination;
    }

    /**
     * @desc Create a new destination
     */
    async create(params: ICreateDestinationRequest): Promise<IDestination> {
        const { data, error } = await this.db
            .from('vw_destinations_public')
            .insert([params])
            .select(
                `
                id,
                name,
                slug,
                metadata,
                created_by,
                created_at,
                updated_at,
                center_lat,
                center_lng,
                base_price,
                area_geojson,
                center_geojson
            `
            )
            .returns<RowWithGeoJSON>()
            .single();

        if (error) {
            throw new BadRequestError(error.message);
        }

        const destination = this.mapRow(data);
        return destination;
    }

    /**
     * @desc Update a destination
     */
    async update(params: { destinationId: string; payload: IUpdateDestinationRequest }): Promise<IDestination> {
        const { destinationId, payload } = params;

        await this.getByIdOrThrowError({ destinationId });

        const { data, error } = await this.db
            .from('vw_destinations_public')
            .update(payload)
            .eq('id', destinationId)
            .select(
                `
                id,
                name,
                slug,
                metadata,
                created_by,
                created_at,
                updated_at,
                center_lat,
                center_lng,
                base_price,
                area_geojson,
                center_geojson
            `
            )
            .returns<RowWithGeoJSON>()
            .single();

        if (error) {
            throw new BadRequestError(error.message);
        }

        const destination = this.mapRow(data);
        return destination;
    }

    /**
     * @desc Delete a destination
     */
    async delete(params: { destinationId: string }): Promise<{ destinationId: string }> {
        const { destinationId } = params;

        await this.getByIdOrThrowError({ destinationId });

        const { error } = await this.db.from('destinations').delete().eq('id', destinationId);

        if (error) {
            throw new BadRequestError(error.message);
        }

        const deletedDestination = { destinationId };
        return deletedDestination;
    }

    // ---------------------
    // PRIVATE UTILITIES
    // ---------------------

    private async getByIdOrThrowError(params: { destinationId: string }): Promise<IDestination> {
        const { destinationId } = params;

        const { data, error } = await this.db
            .from('vw_destinations_public')
            .select(
                `
                id,
                name,
                slug,
                metadata,
                created_by,
                created_at,
                updated_at,
                center_lat,
                center_lng,
                base_price,
                area_geojson,
                center_geojson
            `
            )
            .eq('id', destinationId)
            .returns<RowWithGeoJSON>()
            .maybeSingle();

        if (error) {
            throw new BadRequestError(error.message);
        }

        if (!data) {
            throw new NotFoundError(`Destination with ID ${destinationId} not found`);
        }

        const destination = this.mapRow(data);
        return destination;
    }

    private mapRow(row: RowWithGeoJSON): IDestination {
        const area = row.area_geojson ? JSON.parse(row.area_geojson) : null;
        const center = row.center_geojson ? JSON.parse(row.center_geojson) : null;

        const destination: IDestination = {
            id: row.id,
            name: row.name,
            slug: row.slug,
            area,
            center,
            center_lat: row.center_lat,
            center_lng: row.center_lng,
            base_price: Number(row.base_price ?? 0),
            metadata: row.metadata ?? undefined,
            created_by: row.created_by,
            created_at: row.created_at,
            updated_at: row.updated_at,
        };

        return destination;
    }
}
