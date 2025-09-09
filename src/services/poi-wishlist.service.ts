import { SupabaseClient } from '@supabase/supabase-js';
import { BadRequestError, NotFoundError } from '@hyperflake/http-errors';
import { getDB } from '../configuration/database.config';

export class POIWishlistService {
    private get db(): SupabaseClient {
        return getDB();
    }

    /**
     * @desc Get all wishlisted POIs for a user
     */
    async getAllByUser(params: { userId: string }) {
        const { userId } = params;
        const { data, error } = await this.db.from('poi_wishlist').select('*, poi:pois(*)').eq('user_id', userId);

        if (error) throw new Error(error.message);
        return data;
    }

    /**
     * @desc Add a POI to wishlist
     */
    async add(params: { userId: string; poiId: string }) {
        const { userId, poiId } = params;

        // Prevent duplicates
        const { data: existing, error: existsError } = await this.db
            .from('poi_wishlist')
            .select('*')
            .eq('user_id', userId)
            .eq('poi_id', poiId)
            .maybeSingle();

        if (existsError) throw new Error(existsError.message);
        if (existing) throw new BadRequestError(`POI already wishlisted.`);

        const { data, error } = await this.db
            .from('poi_wishlist')
            .insert([{ user_id: userId, poi_id: poiId }])
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    /**
     * @desc Remove a POI from wishlist
     */
    async remove(params: { userId: string; poiId: string }) {
        const { userId, poiId } = params;

        const { data, error } = await this.db
            .from('poi_wishlist')
            .delete()
            .eq('user_id', userId)
            .eq('poi_id', poiId)
            .select()
            .single();

        if (error) throw new Error(error.message);
        if (!data) throw new NotFoundError(`POI not found in wishlist.`);

        return { poiId, userId };
    }
}
