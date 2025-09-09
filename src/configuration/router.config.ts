import { Express } from 'express';

import authRoutes from '../routes/auth.routes';
import userRoutes from '../routes/user.routes';
import weatherRoutes from '../routes/weather.routes';

export const init = (app: Express) => {
    app.use('/api/users', userRoutes);
    app.use('/api/auth', authRoutes);
    app.use('/api/weather', weatherRoutes);
};
