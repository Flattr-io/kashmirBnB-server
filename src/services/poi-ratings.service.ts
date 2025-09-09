import { SupabaseClient } from '@supabase/supabase-js';
import { IPOIRating } from '../interfaces/poi.interface';
import { BadRequestError, NotFoundError } from '@hyperflake/http-errors';
import { getDB } from '../configuration/database.config';

export class POIRatingService {
    private get db(): SupabaseClient {
        return getDB();
    }

    /**
     * @desc Get all ratings for a POI
     */
    async getAllByPOI(params: { poiId: string }): Promise<IPOIRating[]> {
        const { poiId } = params;

        const { data, error } = await this.db.from('poi_ratings').select('*').eq('poi_id', poiId);

        if (error) throw new Error(error.message);
        return data as IPOIRating[];
    }

    /**
     * @desc Get a rating by ID
     */
    async getById(params: { ratingId: string }): Promise<IPOIRating> {
        return await this.getByIdOrThrowError({ ratingId: params.ratingId });
    }

    /**
     * @desc Create a new rating
     */
    async create(params: {
        poi_id: string;
        user_id: string;
        rating: number;
        review?: string;
        images?: string[];
        visit_date?: string;
    }): Promise<IPOIRating> {
        const { poi_id, user_id, rating, review, images, visit_date } = params;

        if (rating < 1 || rating > 5) {
            throw new BadRequestError('Rating must be between 1 and 5.');
        }

        const { data, error } = await this.db
            .from('poi_ratings')
            .insert([{ poi_id, user_id, rating, review, images, visit_date }])
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data as IPOIRating;
    }

    /**
     * @desc Update a rating
     */
    async update(params: {
        ratingId: string;
        rating?: number;
        review?: string;
        images?: string[];
        visit_date?: string;
    }): Promise<IPOIRating> {
        const { ratingId, ...payload } = params;

        // verify rating exists
        await this.getByIdOrThrowError({ ratingId });

        if (payload.rating && (payload.rating < 1 || payload.rating > 5)) {
            throw new BadRequestError('Rating must be between 1 and 5.');
        }

        const { data, error } = await this.db.from('poi_ratings').update(payload).eq('id', ratingId).select().single();

        if (error) throw new Error(error.message);
        return data as IPOIRating;
    }

    /**
     * @desc Delete a rating
     */
    async delete(params: { ratingId: string }): Promise<{ ratingId: string }> {
        const { ratingId } = params;

        // verify exists
        await this.getByIdOrThrowError({ ratingId });

        const { error } = await this.db.from('poi_ratings').delete().eq('id', ratingId);
        if (error) throw new Error(error.message);

        return { ratingId };
    }

    // ---------------------
    // PRIVATE UTILITIES
    // ---------------------
    private async getByIdOrThrowError(params: { ratingId: string }): Promise<IPOIRating> {
        const { ratingId } = params;
        const { data, error } = await this.db.from('poi_ratings').select('*').eq('id', ratingId).maybeSingle();

        if (error) throw new Error(error.message);
        if (!data) throw new NotFoundError(`Rating with id ${ratingId} not found.`);

        return data as IPOIRating;
    }
}
