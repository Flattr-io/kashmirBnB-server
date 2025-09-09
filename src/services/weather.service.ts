import axios from 'axios';
import { BadRequestError, UnauthorizedError } from '@hyperflake/http-errors';
import { WeatherMapper } from '../utils/weather.mapper';

export class WeatherService {
    private readonly baseUrl = 'https://api.tomorrow.io/v4/weather/forecast';
    private readonly apiKey: string;

    constructor() {
        this.apiKey = process.env.TOMORROW_API_KEY as string;

        if (!this.apiKey) {
            throw new UnauthorizedError('Tomorrow.io API key is missing in environment variables.');
        }
    }

    /**
     * @desc Get simplified weather forecast (hourly + daily) for a given location
     * @param params { lat: number; lon: number }
     */
    async getForecast(params: { lat: number; lon: number }) {
        const { lat, lon } = params;

        if (!lat || !lon) {
            throw new BadRequestError('Latitude and longitude are required.');
        }

        try {
            const response = await axios.get(this.baseUrl, {
                params: {
                    location: `${lat},${lon}`,
                    timesteps: ['hourly', 'daily'].join(','),
                    apikey: this.apiKey,
                },
            });

            const { timelines } = response.data as {
                timelines?: {
                    hourly?: { time: string; values: Record<string, any> }[];
                    daily?: { time: string; values: Record<string, any> }[];
                };
            };

            return {
                hourly: WeatherMapper.mapHourly(timelines?.hourly),
                daily: WeatherMapper.mapDaily(timelines?.daily),
            };
        } catch (error: any) {
            if (error.response) {
                throw new BadRequestError(
                    `Tomorrow.io API error: ${error.response.status} - ${error.response.data.message || 'Unknown error'}`
                );
            }
            throw new BadRequestError(`Failed to fetch weather forecast: ${error.message}`);
        }
    }
}
