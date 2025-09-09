// src/services/mapbox.service.ts
import axios from 'axios';
import { BadRequestError, UnauthorizedError } from '@hyperflake/http-errors';
import { MapboxResponse } from '../interfaces/map.interface';

export class MapboxService {
    private readonly baseUrl = 'https://api.mapbox.com/geocoding/v5/mapbox.places';
    private readonly apiKey: string;

    constructor() {
        this.apiKey = process.env.MAPBOX_API_KEY as string;
        if (!this.apiKey) {
            throw new UnauthorizedError('Mapbox API key is missing in environment variables.');
        }
    }

    /**
     * Forward geocoding: place name → lat/lon
     */
    async forwardGeocode(place: string) {
        if (!place) throw new BadRequestError('Place is required.');

        const response = await axios.get<MapboxResponse>(`${this.baseUrl}/${encodeURIComponent(place)}.json`, {
            params: {
                access_token: this.apiKey,
                limit: 1,
            },
        });

        const feature = response.data.features[0];
        if (!feature) throw new BadRequestError(`No results found for "${place}".`);

        const [lon, lat] = feature.center;
        return { lat, lon, place_name: feature.place_name };
    }

    /**
     * Reverse geocoding: lat/lon → address
     */
    async reverseGeocode(lat: number, lon: number) {
        if (!lat || !lon) throw new BadRequestError('Latitude and longitude are required.');

        const response = await axios.get<MapboxResponse>(`${this.baseUrl}/${lon},${lat}.json`, {
            params: {
                access_token: this.apiKey,
                limit: 1,
            },
        });

        const feature = response.data.features[0];
        return feature?.place_name || 'Unknown location';
    }
}
