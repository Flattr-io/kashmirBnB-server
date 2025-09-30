import { Express } from 'express';

import authRoutes from '../routes/auth.routes';
import userRoutes from '../routes/user.routes';
import weatherRoutes from '../routes/weather.routes';
import destinationRoutes from '../routes/destination.routes';
import poisRoutes from '../routes/pois.routes';
import poiCategoryRoutes from '../routes/poi.category.routes';
import poiRatingRoutes from '../routes/poi-rating.routes';
import poiWishlistRoutes from '../routes/poi.wishlist.routes';
import { getDB } from './database.config';

// Health check throttling: cache DB status to avoid frequent queries
const HEALTH_CHECK_MIN_INTERVAL_MS: number = Number(process.env.HEALTH_CHECK_MIN_INTERVAL_MS || 60000);
let lastHealthCheckAt = 0;
let lastDatabaseStatus: { status: 'pass' | 'fail'; error?: string } | null = null;

export const init = (app: Express) => {

    /**
     * @swagger
     * /api/health:
     *   get:
     *     summary: Health check endpoint
     *     description: Returns comprehensive health status of the API including database connectivity, memory usage, and uptime information. This endpoint is used for monitoring and load balancer health checks.
     *     tags:
     *       - Health
     *     responses:
     *       200:
     *         description: API is healthy and all systems operational
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 status:
     *                   type: string
     *                   enum: [healthy, unhealthy]
     *                   description: Overall health status
     *                   example: healthy
     *                 timestamp:
     *                   type: string
     *                   format: date-time
     *                   description: Health check timestamp
     *                   example: "2024-01-15T10:30:00Z"
     *                 service:
     *                   type: string
     *                   description: Service name
     *                   example: "revam-bnb-api"
     *                 version:
     *                   type: string
     *                   description: API version
     *                   example: "1.0.0"
     *                 checks:
     *                   type: object
     *                   properties:
     *                     database:
     *                       type: object
     *                       properties:
     *                         status:
     *                           type: string
     *                           enum: [pass, fail]
     *                           description: Database connection status
     *                           example: pass
     *                         error:
     *                           type: string
     *                           description: Error message if database check fails
     *                     uptime:
     *                       type: number
     *                       description: Server uptime in seconds
     *                       example: 3600
     *                     responseTime:
     *                       type: number
     *                       description: Health check response time in milliseconds
     *                       example: 25
     *                     memory:
     *                       type: object
     *                       properties:
     *                         used:
     *                           type: number
     *                           description: Used memory in MB
     *                           example: 45
     *                         total:
     *                           type: number
     *                           description: Total memory in MB
     *                           example: 512
     *             examples:
     *               healthy:
     *                 summary: Healthy system
     *                 value:
     *                   status: "healthy"
     *                   timestamp: "2024-01-15T10:30:00Z"
     *                   service: "revam-bnb-api"
     *                   version: "1.0.0"
     *                   checks:
     *                     database:
     *                       status: "pass"
     *                     uptime: 3600
     *                     responseTime: 25
     *                     memory:
     *                       used: 45
     *                       total: 512
     *       503:
     *         description: API is unhealthy - Database connection issues or system problems
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 status:
     *                   type: string
     *                   enum: [unhealthy]
     *                   description: Overall health status
     *                   example: unhealthy
     *                 timestamp:
     *                   type: string
     *                   format: date-time
     *                   description: Health check timestamp
     *                   example: "2024-01-15T10:30:00Z"
     *                 service:
     *                   type: string
     *                   description: Service name
     *                   example: "revam-bnb-api"
     *                 checks:
     *                   type: object
     *                   properties:
     *                     database:
     *                       type: object
     *                       properties:
     *                         status:
     *                           type: string
     *                           enum: [fail]
     *                           description: Database connection status
     *                           example: fail
     *                         error:
     *                           type: string
     *                           description: Database error message
     *                           example: "Connection timeout"
     *                     uptime:
     *                       type: number
     *                       description: Server uptime in seconds
     *                       example: 3600
     *                     responseTime:
     *                       type: number
     *                       description: Health check response time in milliseconds
     *                       example: 5000
     *             examples:
     *               database_error:
     *                 summary: Database connection error
     *                 value:
     *                   status: "unhealthy"
     *                   timestamp: "2024-01-15T10:30:00Z"
     *                   service: "revam-bnb-api"
     *                   checks:
     *                     database:
     *                       status: "fail"
     *                       error: "Connection timeout"
     *                     uptime: 3600
     *                     responseTime: 5000
     */
    app.get('/api/health', async (req, res) => {
        try {
            const startTime = Date.now();

            // Decide whether to perform a fresh DB check or reuse cached result
            const now = Date.now();
            const shouldCheckDb = now - lastHealthCheckAt >= HEALTH_CHECK_MIN_INTERVAL_MS || !lastDatabaseStatus;

            if (shouldCheckDb) {
                const db = getDB();
                const { error } = await db
                    .from('destinations')
                    .select('id')
                    .limit(1);

                if (error) {
                    lastDatabaseStatus = { status: 'fail', error: error.message };
                } else {
                    lastDatabaseStatus = { status: 'pass' };
                }
                lastHealthCheckAt = now;
            }

            res.status(200).json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                service: 'revam-bnb-api',
                version: process.env.npm_package_version || '1.0.0',
                checks: {
                    database: lastDatabaseStatus || { status: 'pass' },
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
    app.use('/api/pois', poisRoutes);
    app.use('/api/poi-categories', poiCategoryRoutes);
    app.use('/api/poi-ratings', poiRatingRoutes);
    app.use('/api/poi-wishlist', poiWishlistRoutes);
};
