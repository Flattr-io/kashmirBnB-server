import { NextFunction, Request, Response } from 'express';
import { AuthService } from '../services/auth.service';

export async function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const authService = new AuthService();
            const user = await authService.verifyToken(token);
            (req as any).user = user;
        }

        next();
    } catch (err) {
        // Continue without user context for unauthenticated requests
        next();
    }
}


