import { Express } from 'express';
import userRoutes from '../routes/user.routes';
import authRoutes from '../routes/auth.routes';

export const init = (app: Express) => {
    app.use('/api/users', userRoutes);
    app.use('/api/auth', authRoutes);
};
