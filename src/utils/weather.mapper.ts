import { HourlyForecast, DailyForecast } from '../interfaces/weather.interface';

export class WeatherMapper {
    /**
     * Map raw hourly data from Tomorrow.io to HourlyForecast[]
     */
    static mapHourly(hourly: any[] = []): HourlyForecast[] {
        return hourly.map((item) => ({
            time: item.time,
            temperature: item.values.temperature,
            feelsLike: item.values.temperatureApparent,
            humidity: item.values.humidity,
            precipitationProbability: item.values.precipitationProbability,
            uvIndex: item.values.uvIndex,
            wind: {
                speed: item.values.windSpeed,
                gust: item.values.windGust,
                direction: item.values.windDirection,
            },
            visibility: item.values.visibility,
            weatherCode: item.values.weatherCode,
        }));
    }

    /**
     * Map raw daily data from Tomorrow.io to DailyForecast[]
     */
    static mapDaily(daily: any[] = []): DailyForecast[] {
        return daily.map((item) => ({
            time: item.time,
            temperature: {
                min: item.values.temperatureMin,
                max: item.values.temperatureMax,
                avg: item.values.temperatureAvg,
            },
            feelsLike: {
                min: item.values.temperatureApparentMin,
                max: item.values.temperatureApparentMax,
                avg: item.values.temperatureApparentAvg,
            },
            humidity: {
                min: item.values.humidityMin,
                max: item.values.humidityMax,
                avg: item.values.humidityAvg,
            },
            precipitationProbability: {
                min: item.values.precipitationProbabilityMin,
                max: item.values.precipitationProbabilityMax,
                avg: item.values.precipitationProbabilityAvg,
            },
            uvIndex: {
                min: item.values.uvIndexMin,
                max: item.values.uvIndexMax,
                avg: item.values.uvIndexAvg,
            },
            sunrise: item.values.sunriseTime,
            sunset: item.values.sunsetTime,
            wind: {
                avg: item.values.windSpeedAvg,
                max: item.values.windSpeedMax,
                direction: item.values.windDirectionAvg,
            },
            visibility: {
                min: item.values.visibilityMin,
                max: item.values.visibilityMax,
                avg: item.values.visibilityAvg,
            },
            weatherCode: {
                min: item.values.weatherCodeMin,
                max: item.values.weatherCodeMax,
            },
        }));
    }
}
