import cors from 'cors';
import express, { Express } from 'express';
import moment from 'moment';
import morgan from 'morgan';
import dotenv from 'dotenv';

import { init as initDatabase } from '../configuration/database.config';
import { init as initRouter } from '../configuration/router.config';
import { errorHandler } from '../middlewares/error-handler.middleware';
import { setupSwagger } from './swagger';

dotenv.config();

const origin = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*';

export class AppBootstrap {
    private app: Express;
    private corsOptions = {
        origin,
        optionsSuccessStatus: 200,
    };

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
        initDatabase(url, key); // initializes singleton
        return this;
    }

    listen() {
        const port = process.env.PORT || 3000;
        this.app.listen(port, () => {
            console.log(`🚀 App listening on port ${port}...`);
        });
    }

    static run() {
        new AppBootstrap().initDatabase().setMiddlewares().setRoutes().setErrorHandler().listen();
    }

    static runInTestMode() {
        new AppBootstrap().setMiddlewares().setRoutes().setErrorHandler();
    }
}
