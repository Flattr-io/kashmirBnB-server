import { Express } from 'express';

import authRoutes from '../routes/auth.routes';
import userRoutes from '../routes/user.routes';
import weatherRoutes from '../routes/weather.routes';
import destinationRoutes from '../routes/destination.routes';
import { getDB } from './database.config';

export const init = (app: Express) => {

    app.get('/api/health', async (req, res) => {
        try {
            const startTime = Date.now();
            
            // Test database connectivity
            const db = getDB();
            const { data, error } = await db
                .from('destinations')
                .select('id')
                .limit(1);
            
            if (error) {
                return res.status(503).json({
                    status: 'unhealthy',
                    timestamp: new Date().toISOString(),
                    service: 'revam-bnb-api',
                    checks: {
                        database: { status: 'fail', error: error.message },
                        uptime: process.uptime(),
                        responseTime: Date.now() - startTime
                    }
                });
            }

            res.status(200).json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                service: 'revam-bnb-api',
                version: process.env.npm_package_version || '1.0.0',
                checks: {
                    database: { status: 'pass' },
                    uptime: process.uptime(),
                    responseTime: Date.now() - startTime,
                    memory: {
                        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
                    }
                }
            });
        } catch (error: any) {
            res.status(503).json({
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                service: 'revam-bnb-api',
                checks: {
                    database: { status: 'fail', error: error.message },
                    uptime: process.uptime()
                }
            });
        }
    });

    app.use('/api/users', userRoutes);
    app.use('/api/auth', authRoutes);
    app.use('/api/weather', weatherRoutes);
    app.use('/api/destinations', destinationRoutes);
};
