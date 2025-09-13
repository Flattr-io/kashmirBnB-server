export interface HourlyForecast {
    time: string; // ISO datetime
    temperature: number;
    feelsLike: number;
    humidity: number;
    precipitationProbability: number;
    uvIndex: number;
    wind: {
        speed: number;
        gust: number;
        direction: number;
    };
    visibility: number;
    weatherCode: number;
}

export interface DailyForecast {
    time: string; // ISO datetime
    temperature: {
        min: number;
        max: number;
        avg: number;
    };
    feelsLike: {
        min: number;
        max: number;
        avg: number;
    };
    humidity: {
        min: number;
        max: number;
        avg: number;
    };
    precipitationProbability: {
        min: number;
        max: number;
        avg: number;
    };
    uvIndex: {
        min: number;
        max: number;
        avg: number;
    };
    sunrise: string; // ISO datetime
    sunset: string; // ISO datetime
    wind: {
        avg: number;
        max: number;
        direction: number;
    };
    visibility: {
        min: number;
        max: number;
        avg: number;
    };
    weatherCode: {
        min: number;
        max: number;
    };
}

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
