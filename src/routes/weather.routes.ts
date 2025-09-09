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
    const { lat, lon } = req.body;
    const forecast = await weatherService.getForecast({ lat, lon });
    res.send(forecast);
});

export default router;
