import cron from 'node-cron';
import { WeatherService } from '../services/weather.service';
import { getDB } from '../configuration/database.config';
import { SupabaseClient } from '@supabase/supabase-js';
import moment from 'moment-timezone';

export class WeatherScheduler {
    private readonly weatherService: WeatherService;
    private readonly db: SupabaseClient;

    constructor() {
        this.weatherService = new WeatherService();
        this.db = getDB();
    }

    /**
     * Start scheduler
     * Runs cron every 3 hours only when needed (0, 3, 6, 9, 12, 15, 18, 21, and final at 23:59)
     */
    public start() {
        // Run every 3 hours at minute 0
        cron.schedule('0 0,3,6,9,12,15,18,21 * * *', async () => {
            console.log(`[WeatherScheduler] Running 3-hour scheduled update at ${new Date().toISOString()}`);
            await this.updateWeatherSnapshots();
        });

        // Final daily snapshot at 23:59
        cron.schedule('59 23 * * *', async () => {
            console.log(`[WeatherScheduler] Running final daily update at ${new Date().toISOString()}`);
            await this.updateWeatherSnapshots(true);
        });
    }

    public async updateWeatherSnapshots(isFinal: boolean = false) {
        const { data: destinations, error } = await this.db
            .from('destinations')
            .select('id, name, center_lat, center_lng');

        if (error) {
            console.error('[WeatherScheduler] Failed to fetch destinations:', error.message);
            return;
        }

        if (!destinations || destinations.length === 0) {
            console.log('[WeatherScheduler] No destinations found.');
            return;
        }

        const updatePromises = destinations.map(async (dest) => {
            try {
                const nowLocal = moment.tz('Asia/Kolkata'); // Default to India timezone for Kashmir destinations
                
                await this.weatherService.fetchAndStoreForDestination(dest.id, isFinal);

                console.log(
                    `[WeatherScheduler] Updated ${dest.name} (${dest.id}) at ${nowLocal.format()} | is_final=${isFinal}`
                );
            } catch (err: any) {
                console.error(`[WeatherScheduler] Failed for ${dest.name}:`, err.message);
            }
        });

        // Process all destinations in parallel for better performance
        await Promise.allSettled(updatePromises);
    }
}
