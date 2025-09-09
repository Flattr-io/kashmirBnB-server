import { SupabaseClient } from '@supabase/supabase-js';
import { getDB } from '../configuration/database.config';
import { ICreateWeatherRequest, IDestinationWeather } from '../interfaces/destination-weather.interface';

export class DestinationWeatherService {
    private get db(): SupabaseClient {
        return getDB();
    }

    /**
     * @desc Get latest weather data for a destination
     */

    async getLatest(destinationId: string, date: string): Promise<IDestinationWeather | null> {
        const { data, error } = await this.db
            .from('destination_weather')
            .select('*')
            .eq('destination_id', destinationId)
            .eq('date', date)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error) throw new Error(error.message);
        return data as IDestinationWeather | null;
    }

    /**
     * @desc Get upsert weather data for a destination
     */

    async upsertWeather(params: ICreateWeatherRequest): Promise<IDestinationWeather> {
        const { destination_id, date, hourly, daily, is_final = false } = params;

        // If this is the final entry, mark existing entries as non-final
        if (is_final) {
            const { error: resetError } = await this.db
                .from('destination_weather')
                .update({ is_final: false })
                .eq('destination_id', destination_id)
                .eq('date', date);
            if (resetError) throw new Error(resetError.message);
        }

        // Upsert the new weather entry
        const { data, error } = await this.db
            .from('destination_weather')
            .upsert(
                {
                    destination_id,
                    date,
                    hourly,
                    daily,
                    is_final,
                },
                { onConflict: 'destination_id' }
            )
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data as IDestinationWeather;
    }
}
