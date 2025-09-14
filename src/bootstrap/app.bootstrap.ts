import cors from 'cors';
import express, { Express } from 'express';
import moment from 'moment';
import morgan from 'morgan';
import dotenv from 'dotenv';

import { init as initDatabase } from '../configuration/database.config';
import { init as initRouter } from '../configuration/router.config';
import { errorHandler } from '../middlewares/error-handler.middleware';
import { setupSwagger } from './swagger';
import { WeatherScheduler } from '../utils/weather.scheduler';

dotenv.config();

const origin = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*';

export class AppBootstrap {
    private app: Express;
    private corsOptions = {
        origin,
        optionsSuccessStatus: 200,
    };

    private scheduler?: WeatherScheduler;

    constructor() {
        this.app = express();
    }

    getApp() {
        return this.app;
    }

    setMiddlewares() {
        this.app.use(cors(this.corsOptions));

        morgan.token('date', () => moment().format('DD/MM/YYYY hh:mm:ss a'));
        this.app.use(morgan(':method :url HTTP/:http-version :status - :response-time ms - :date'));

        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        return this;
    }

    setRoutes() {
        initRouter(this.app);
        setupSwagger(this.app);
        return this;
    }

    setErrorHandler() {
        this.app.use(errorHandler);
        return this;
    }

    initDatabase() {
        const url = process.env.SUPABASE_URL!;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        initDatabase(url, key);
        return this;
    }

    initSchedulers() {
        this.scheduler = new WeatherScheduler();
        this.scheduler.start();
        console.log('⏰ WeatherScheduler initialized (every 3 hours).');
        return this;
    }

    listen() {
        const port = Number(process.env.PORT) || 3000;
        this.app.listen(port, '0.0.0.0', () => {
            console.log(`🚀 App listening on port ${port}...`);
        });
    }

    static run() {
        new AppBootstrap().initDatabase().setMiddlewares().setRoutes().setErrorHandler().initSchedulers().listen();
    }

    static runInTestMode() {
        new AppBootstrap().setMiddlewares().setRoutes().setErrorHandler();
    }
}
