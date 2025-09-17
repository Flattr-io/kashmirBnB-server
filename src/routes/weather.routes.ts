import { Request, Response, Router } from 'express';
import { WeatherService } from '../services/weather.service';

const router = Router();
const weatherService = new WeatherService();

/**
 * @swagger
 * /weather/forecast:
 *   post:
 *     summary: Get weather forecast for a destination
 *     description: Retrieves weather forecast data for a specific destination. This endpoint fetches stored weather data from the database, which is updated automatically every 3 hours by the weather scheduler. The data includes comprehensive hourly weather information including temperature, humidity, wind, UV index, precipitation probability, and more. Data is available for the next 120 hours (5 days).
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
 *               summary: Valid forecast request for Srinagar
 *               value:
 *                 destination_id: "6d04f442-3f07-4f72-90aa-bb75a7bbd167"
 *             invalid_request:
 *               summary: Invalid request (missing destination_id)
 *               value: {}
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
 *                   daily: []
 *                   hourly:
 *                     - time: "2025-09-17T19:00:00Z"
 *                       temperature: 14.4
 *                       feelsLike: 14.4
 *                       humidity: 83
 *                       precipitationProbability: 0
 *                       uvIndex: 0
 *                       wind:
 *                         speed: 0.6
 *                         gust: 2.9
 *                         direction: 60
 *                       visibility: 16
 *                       weatherCode: 1000
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
 *                   error: "Bad Request"
 *                   message: "destination_id is required"
 *                   statusCode: 400
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
    const { destination_id } = req.body;
    
    if (!destination_id) {
        return res.status(400).json({
            error: 'Bad Request',
            message: 'destination_id is required',
            statusCode: 400
        });
    }
    
    const forecast = await weatherService.getStoredForecast(destination_id);
    res.send(forecast);
});

/**
 * @swagger
 * /weather/update:
 *   post:
 *     summary: Manually trigger weather update for all destinations
 *     description: Triggers weather data fetch and storage for all destinations. This is useful for testing or manual updates. The weather scheduler automatically updates data every 3 hours, but this endpoint allows for immediate updates when needed. Fetches 120 hours of hourly weather data for each destination.
 *     tags:
 *       - Weather
 *     responses:
 *       200:
 *         description: Weather update triggered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Weather update triggered for all destinations"
 *                 destinations:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "6d04f442-3f07-4f72-90aa-bb75a7bbd167"
 *                       name:
 *                         type: string
 *                         example: "Srinagar"
 *       500:
 *         description: Internal server error
 */
router.post('/update', async (req: Request, res: Response) => {
    try {
        const { WeatherScheduler } = await import('../utils/weather.scheduler');
        const scheduler = new WeatherScheduler();
        
        // Trigger weather update for all destinations
        await (scheduler as any).updateWeatherSnapshots(false);
        
        res.json({ 
            message: "Weather update triggered for all destinations",
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        res.status(500).json({ 
            error: "Failed to trigger weather update", 
            message: error.message 
        });
    }
});

export default router;
