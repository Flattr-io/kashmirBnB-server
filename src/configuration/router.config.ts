import { Express } from 'express';

import authRoutes from '../routes/auth.routes';
import userRoutes from '../routes/user.routes';
import weatherRoutes from '../routes/weather.routes';
import destinationRoutes from '../routes/destination.routes';

export const init = (app: Express) => {

    app.get('/api/health', (req, res) => {
        res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            service: 'revam-bnb-api',
        });
    });

    app.use('/api/users', userRoutes);
    app.use('/api/auth', authRoutes);
    app.use('/api/weather', weatherRoutes);
    app.use('/api/destinations', destinationRoutes);
};
