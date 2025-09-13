import { Request, Response, Router } from 'express';
import { WeatherService } from '../services/weather.service';

const router = Router();
const weatherService = new WeatherService();

/**
 * @method POST
 * @desc   Get weather forecast by location
 * @access Public
 */
router.post('/forecast', async (req: Request, res: Response) => {
    const { destinationId } = req.body;
    const forecast = await weatherService.getStoredForecast(destinationId);
    res.send(forecast);
});

export default router;
