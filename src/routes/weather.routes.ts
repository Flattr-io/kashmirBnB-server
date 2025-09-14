import { Request, Response, Router } from 'express';
import { WeatherService } from '../services/weather.service';

const router = Router();
const weatherService = new WeatherService();

/**
 * @swagger
 * /weather/forecast:
 *   post:
 *     summary: Get weather forecast for a destination
 *     description: Retrieves weather forecast data for a specific destination. This endpoint fetches stored weather data from the database, which is updated periodically by the weather scheduler.
 *     tags:
 *       - Weather
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateWeatherRequest'
 *           examples:
 *             valid_request:
 *               summary: Valid forecast request
 *               value:
 *                 destination_id: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Weather forecast retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DestinationWeather'
 *             examples:
 *               success:
 *                 summary: Successful forecast retrieval
 *                 value:
 *                   id: "123e4567-e89b-12d3-a456-426614174000"
 *                   destination_id: "123e4567-e89b-12d3-a456-426614174000"
 *                   daily:
 *                     - date: "2024-01-15"
 *                       temperatureMin: 8.5
 *                       temperatureMax: 18.2
 *                       humidity: 70.0
 *                       precipitation: 5.2
 *                       windSpeed: 15.8
 *                       weatherCode: 1001
 *                       hourly:
 *                         - time: "2024-01-15T12:00:00Z"
 *                           temperature: 15.5
 *                           humidity: 65.0
 *                           precipitation: 2.5
 *                           windSpeed: 12.3
 *                           weatherCode: 1001
 *                   created_at: "2024-01-15T10:30:00Z"
 *       400:
 *         description: Bad request - Invalid destination ID or missing data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               invalid_destination:
 *                 summary: Invalid destination ID
 *                 value:
 *                   error: "Invalid destination ID"
 *                   message: "The provided destination ID is not valid"
 *                   statusCode: 400
 *                   timestamp: "2024-01-15T10:30:00Z"
 *               missing_destination_id:
 *                 summary: Missing destination ID
 *                 value:
 *                   error: "Missing destination ID"
 *                   message: "Destination ID is required"
 *                   statusCode: 400
 *                   timestamp: "2024-01-15T10:30:00Z"
 *       404:
 *         description: Weather data not found for the destination
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               no_weather_data:
 *                 summary: No weather data found
 *                 value:
 *                   error: "Weather data not found"
 *                   message: "No weather forecast available for this destination"
 *                   statusCode: 404
 *                   timestamp: "2024-01-15T10:30:00Z"
 *       422:
 *         description: Validation error - Invalid input format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *             examples:
 *               invalid_uuid:
 *                 summary: Invalid UUID format
 *                 value:
 *                   error: "Validation Error"
 *                   message: "Invalid input format"
 *                   details:
 *                     - field: "destination_id"
 *                       message: "Destination ID must be a valid UUID"
 *                   statusCode: 422
 *                   timestamp: "2024-01-15T10:30:00Z"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               server_error:
 *                 summary: Server error
 *                 value:
 *                   error: "Internal Server Error"
 *                   message: "An unexpected error occurred while fetching weather data"
 *                   statusCode: 500
 *                   timestamp: "2024-01-15T10:30:00Z"
 */
router.post('/forecast', async (req: Request, res: Response) => {
    const { destinationId } = req.body;
    const forecast = await weatherService.getStoredForecast(destinationId);
    res.send(forecast);
});

export default router;
