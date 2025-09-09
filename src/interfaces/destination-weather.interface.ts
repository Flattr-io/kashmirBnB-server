/**
 * Weather data linked to destinations
 */
export interface IDestinationWeather {
    id: string;
    destination_id: string;
    date: string; // YYYY-MM-DD
    hourly: Array<{}>;
    daily: Array<{}>;
    is_final: boolean;
    created_at: string;
}

/**
 * Create/Upsert Weather request DTO
 */
export interface ICreateWeatherRequest {
    destination_id: string;
    date: string; // YYYY-MM-DD
    hourly: Array<{}>;
    daily: Array<{}>;
    is_final?: boolean;
}
