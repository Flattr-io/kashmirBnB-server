import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NotFoundError } from '@hyperflake/http-errors';

let supabase: SupabaseClient | null = null;

/**
 * Initialize Supabase client once
 */
export const init = (url: string, key: string) => {
    if (!supabase) {
        supabase = createClient(url, key);
        console.log('✅ Supabase initialized.');
    }
};

/**
 * Get Supabase client anywhere
 */
export const getDB = (): SupabaseClient => {
    if (!supabase) throw new NotFoundError('Supabase client not initialized!');
    return supabase;
};
