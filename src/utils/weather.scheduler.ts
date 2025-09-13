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
     * Runs cron every hour to check if a destination is due for update
     */
    public start() {
        // Run every hour on the hour
        cron.schedule('0 * * * *', async () => {
            console.log(`[WeatherScheduler] Running hourly check at ${new Date().toISOString()}`);
            await this.updateWeatherSnapshots();
        });
    }

    private async updateWeatherSnapshots() {
        const { data: destinations, error } = await this.db
            .from('destinations')
            .select('id, timezone, name, is_active')
            .eq('is_active', true);

        if (error) {
            console.error('[WeatherScheduler] Failed to fetch destinations:', error.message);
            return;
        }

        if (!destinations || destinations.length === 0) {
            console.log('[WeatherScheduler] No active destinations found.');
            return;
        }

        for (const dest of destinations) {
            try {
                const nowLocal = moment.tz(dest.timezone || 'UTC');
                const hour = nowLocal.hour();
                const minute = nowLocal.minute();

                // Fetch every 3 hours (0, 3, 6, 9, 12, 15, 18, 21)
                const is3HourInterval = hour % 3 === 0 && minute === 0;

                // Final snapshot at 23:59
                const isFinalRun = hour === 23 && minute === 59;

                if (!is3HourInterval && !isFinalRun) {
                    continue; // skip if not a scheduled time
                }

                await this.weatherService.fetchAndStoreForDestination(dest.id, isFinalRun);

                console.log(
                    `[WeatherScheduler] Updated ${dest.name} (${dest.id}) at ${nowLocal.format()} | is_final=${isFinalRun}`
                );
            } catch (err: any) {
                console.error(`[WeatherScheduler] Failed for ${dest.name}:`, err.message);
            }
        }
    }
}
