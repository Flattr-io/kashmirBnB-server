import axios from 'axios';
import { BadRequestError, UnauthorizedError, NotFoundError } from '@hyperflake/http-errors';
import { WeatherMapper } from '../utils/weather.mapper';
import { SupabaseClient } from '@supabase/supabase-js';
import { getDB } from '../configuration/database.config';
import { ICreateWeatherRequest } from '../interfaces/weather.interface';

export class WeatherService {
    private readonly baseUrl = 'https://api.tomorrow.io/v4/weather/forecast';
    private readonly apiKey: string;

    constructor() {
        this.apiKey = process.env.TOMORROW_API_KEY as string;
        if (!this.apiKey) {
            throw new UnauthorizedError('Tomorrow.io API key is missing in environment variables.');
        }
    }

    private get db(): SupabaseClient {
        return getDB();
    }

    /**
     * @desc Fetch forecast (hourly + daily) from Tomorrow.io
     */
    private async fetchFromProvider(lat: number, lon: number, range?: { start?: string; end?: string }) {
        try {
            const params: any = {
                location: `${lat},${lon}`,
                timesteps: ['1h', '1d'],
                apikey: this.apiKey,
            };
            if (range?.start) params.startTime = range.start;
            if (range?.end) params.endTime = range.end;

            const response = await axios.get(this.baseUrl, { params });

            const { timelines } = response.data as {
                timelines?: {
                    hourly?: { time: string; values: Record<string, any> }[];
                    daily?: { time: string; values: Record<string, any> }[];
                };
            };

            if (!timelines || (!timelines.hourly && !timelines.daily)) {
                throw new BadRequestError('Invalid response format from Tomorrow.io API');
            }

            return {
                hourly: WeatherMapper.mapHourly(timelines.hourly || []),
                daily: WeatherMapper.mapDaily(timelines.daily || []),
            };
        } catch (error: any) {
            if (error.response) {
                throw new BadRequestError(
                    `Tomorrow.io API error: ${error.response.status} - ${error.response.data?.message || 'Unknown error'}`
                );
            }
            throw new BadRequestError(`Failed to fetch weather forecast: ${error.message}`);
        }
    }

    /**
     * @desc Fetch weather for a destination and upsert into DB
     */
    async fetchAndStoreForDestination(destinationId: string, isFinal: boolean = false): Promise<void> {
        // Get destination coordinates
        const { data: dest, error: destErr } = await this.db
            .from('destinations')
            .select('id, center_lat, center_lng')
            .eq('id', destinationId)
            .maybeSingle();

        if (destErr) throw new BadRequestError(destErr.message);
        if (!dest) throw new NotFoundError(`Destination not found: ${destinationId}`);

        const lat = dest.center_lat as number;
        const lon = dest.center_lng as number;

        if (typeof lat !== 'number' || typeof lon !== 'number') {
            throw new BadRequestError(`Invalid coordinates for destination ${destinationId}`);
        }

        // Fetch data from provider (returns ~5 days of forecast)
        const forecast = await this.fetchFromProvider(lat, lon);

        console.log(`[WeatherService] Fetched forecast: ${forecast.hourly.length} hourly records, ${forecast.daily.length} daily records`);

        // Group hourly data by date (YYYY-MM-DD)
        const hourlyByDate = new Map<string, any[]>();
        for (const h of forecast.hourly) {
            const d = (h.time || '').slice(0, 10);
            if (!d || d.length !== 10) {
                console.warn(`[WeatherService] Skipping invalid hourly time: ${h.time}`);
                continue;
            }
            if (!hourlyByDate.has(d)) hourlyByDate.set(d, []);
            hourlyByDate.get(d)!.push(h);
        }

        // Group daily aggregates by date (YYYY-MM-DD)
        const dailyByDate = new Map<string, any>();
        for (const d of forecast.daily) {
            const day = (d.time || '').slice(0, 10);
            if (!day || day.length !== 10) {
                console.warn(`[WeatherService] Skipping invalid daily time: ${d.time}`);
                continue;
            }
            dailyByDate.set(day, d);
        }

        // Get all unique dates from both hourly and daily data
        const dates = new Set<string>([...hourlyByDate.keys(), ...dailyByDate.keys()]);

        console.log(`[WeatherService] Parsed dates: ${Array.from(dates).sort().join(', ')}`);
        console.log(`[WeatherService] Saving ${dates.size} days of weather data for destination ${destinationId}`);

        // Save each day as a separate row with both hourly and daily data
        // Use Promise.allSettled to ensure all dates are attempted even if one fails
        const savePromises = Array.from(dates).map(async (day) => {
            const hourlyForDay = hourlyByDate.get(day) || [];
            const dailyForDay = dailyByDate.get(day);
            
            try {
                await this.upsertSnapshot({
                    destination_id: destinationId,
                    date: day,
                    hourly: hourlyForDay,
                    daily: dailyForDay ? [dailyForDay] : [],
                    is_final: isFinal,
                });
                
                console.log(`[WeatherService] ✓ Saved snapshot for ${day}: ${hourlyForDay.length} hourly records, ${dailyForDay ? 1 : 0} daily record(s)`);
                return { day, success: true };
            } catch (err: any) {
                console.error(`[WeatherService] ✗ Failed to save snapshot for ${day}:`, err.message, err);
                return { day, success: false, error: err.message };
            }
        });

        const results = await Promise.allSettled(savePromises);
        const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;
        
        console.log(`[WeatherService] Save complete: ${successful} succeeded, ${failed} failed out of ${dates.size} total days`);
        
        if (failed > 0) {
            console.error(`[WeatherService] Some weather snapshots failed to save. Check logs above for details.`);
        }
    }

    /**
     * @desc Fetch weather for a specific date and upsert snapshot for that date
     * Note: Fetches full 5-day forecast window to maximize API efficiency, then saves all days
     */
    async fetchAndStoreForDestinationDate(destinationId: string, dateISO: string, isFinal: boolean = false): Promise<void> {
        const { data: dest, error: destErr } = await this.db
            .from('destinations')
            .select('id, center_lat, center_lng')
            .eq('id', destinationId)
            .maybeSingle();

        if (destErr) throw new BadRequestError(destErr.message);
        if (!dest) throw new NotFoundError(`Destination not found: ${destinationId}`);

        const lat = dest.center_lat as number;
        const lon = dest.center_lng as number;

        if (typeof lat !== 'number' || typeof lon !== 'number') {
            throw new BadRequestError(`Invalid coordinates for destination ${destinationId}`);
        }

        // Fetch full forecast window (returns ~5 days) to maximize API efficiency
        const forecast = await this.fetchFromProvider(lat, lon);

        console.log(`[WeatherService] Fetched forecast: ${forecast.hourly.length} hourly records, ${forecast.daily.length} daily records`);

        // Group hourly data by date (YYYY-MM-DD)
        const hourlyByDate = new Map<string, any[]>();
        for (const h of forecast.hourly) {
            const d = (h.time || '').slice(0, 10);
            if (!d || d.length !== 10) {
                console.warn(`[WeatherService] Skipping invalid hourly time: ${h.time}`);
                continue;
            }
            if (!hourlyByDate.has(d)) hourlyByDate.set(d, []);
            hourlyByDate.get(d)!.push(h);
        }

        // Group daily aggregates by date (YYYY-MM-DD)
        const dailyByDate = new Map<string, any>();
        for (const d of forecast.daily) {
            const day = (d.time || '').slice(0, 10);
            if (!day || day.length !== 10) {
                console.warn(`[WeatherService] Skipping invalid daily time: ${d.time}`);
                continue;
            }
            dailyByDate.set(day, d);
        }

        // Get all unique dates from both hourly and daily data
        const dates = new Set<string>([...hourlyByDate.keys(), ...dailyByDate.keys()]);

        console.log(`[WeatherService] Parsed dates: ${Array.from(dates).sort().join(', ')}`);
        console.log(`[WeatherService] Saving ${dates.size} days of weather data for destination ${destinationId} (requested date: ${dateISO})`);

        // Save each day as a separate row with both hourly and daily data
        // Use Promise.allSettled to ensure all dates are attempted even if one fails
        const savePromises = Array.from(dates).map(async (day) => {
            const hourlyForDay = hourlyByDate.get(day) || [];
            const dailyForDay = dailyByDate.get(day);
            
            try {
                await this.upsertSnapshot({
                    destination_id: destinationId,
                    date: day,
                    hourly: hourlyForDay,
                    daily: dailyForDay ? [dailyForDay] : [],
                    is_final: isFinal,
                });
                
                console.log(`[WeatherService] ✓ Saved snapshot for ${day}: ${hourlyForDay.length} hourly records, ${dailyForDay ? 1 : 0} daily record(s)`);
                return { day, success: true };
            } catch (err: any) {
                console.error(`[WeatherService] ✗ Failed to save snapshot for ${day}:`, err.message, err);
                return { day, success: false, error: err.message };
            }
        });

        const results = await Promise.allSettled(savePromises);
        const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;
        
        console.log(`[WeatherService] Save complete: ${successful} succeeded, ${failed} failed out of ${dates.size} total days`);
        
        if (failed > 0) {
            console.error(`[WeatherService] Some weather snapshots failed to save. Check logs above for details.`);
        }
    }

    /**
     * @desc Get latest stored forecast for a destination (always DB, no API call)
     */
    async getStoredForecast(destinationId: string) {
        const { data: snapshot, error } = await this.db
            .from('weather_snapshots')
            .select('destination_id, snapshot_date, mapped, is_final, created_at, updated_at')
            .eq('destination_id', destinationId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw new BadRequestError(error.message);
        if (!snapshot) throw new NotFoundError(`No weather snapshot found for destination: ${destinationId}`);

        return {
            destination_id: snapshot.destination_id,
            snapshot_date: snapshot.snapshot_date,
            mapped: snapshot.mapped,
            is_final: snapshot.is_final,
            created_at: snapshot.created_at,
            updated_at: snapshot.updated_at,
        };
    }

    /**
     * @desc Save or update weather snapshot in DB
     */
    private async upsertSnapshot(payload: ICreateWeatherRequest): Promise<void> {
        try {
            const upsertData = {
                destination_id: payload.destination_id,
                snapshot_date: payload.date,
                mapped: {
                    hourly: payload.hourly || [],
                    daily: payload.daily || [],
                },
                is_final: payload.is_final ?? false,
            };

            const { data, error } = await this.db.from('weather_snapshots').upsert(
                upsertData,
                {
                    onConflict: 'destination_id,snapshot_date',
                }
            );

            if (error) {
                console.error(`[WeatherService] DB upsert error for ${payload.date}:`, error);
                throw new BadRequestError(`DB upsert error: ${error.message} (code: ${error.code})`);
            }
        } catch (err: any) {
            console.error(`[WeatherService] Failed to save weather snapshot for ${payload.date}:`, err);
            throw new BadRequestError(`Failed to save weather snapshot: ${err.message}`);
        }
    }
}
