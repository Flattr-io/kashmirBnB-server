import { Request, Response, NextFunction } from 'express';
import createError from 'http-errors';
import { AuthService } from '../services/auth.service';

const authService = new AuthService();

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next(createError(401, 'Unauthorized'));
        }

        const token = authHeader.split(' ')[1];
        const user = await authService.verifyToken(token);

        // Attach user to request for route handlers
        (req as any).user = user;

        next();
    } catch (err: any) {
        return next(createError(401, err?.message || 'Unauthorized'));
    }
}
