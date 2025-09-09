import { SupabaseClient } from '@supabase/supabase-js';
import { getDB } from '../configuration/database.config';

import { NotFoundError, BadRequestError } from '@hyperflake/http-errors';
import {
    ICreateDestinationRequest,
    IDestination,
    IUpdateDestinationRequest,
} from '../interfaces/destination.interface';

export class DestinationService {
    private get db(): SupabaseClient {
        return getDB();
    }

    /**
     * @desc Get all destinations
     */

    async getAll(): Promise<IDestination[]> {
        const { data, error } = await this.db.from('destinations').select('*');
        if (error) throw new Error(error.message);
        return data as IDestination[];
    }

    /**
     * @desc Get destination by ID
     */

    async getById(destinationId: string): Promise<IDestination> {
        const { data, error } = await this.db.from('destinations').select('*').eq('id', destinationId).maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) throw new NotFoundError(`Destination with ID ${destinationId} not found.`);
        return data as IDestination;
    }
    /**
     * @desc Create a new destination
     */
    async create(params: ICreateDestinationRequest): Promise<IDestination> {
        const { data, error } = await this.db.from('destinations').insert([params]).select().single();
        if (error) throw new Error(error.message);
        return data as IDestination;
    }
    /**
     * @desc Update a destination by ID
     */
    async update(destinationId: string, payload: IUpdateDestinationRequest): Promise<IDestination> {
        await this.getById(destinationId); // ensure it exists
        const { data, error } = await this.db
            .from('destinations')
            .update(payload)
            .eq('id', destinationId)
            .select()
            .single();
        if (error) throw new Error(error.message);
        return data as IDestination;
    }

    /**
     * @desc Delete a destination by ID
     */

    async delete(destinationId: string): Promise<{ destinationId: string }> {
        await this.getById(destinationId); // ensure it exists
        const { error } = await this.db.from('destinations').delete().eq('id', destinationId);
        if (error) throw new Error(error.message);
        return { destinationId };
    }
}
