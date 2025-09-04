import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';

const authService = new AuthService();

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const token = authHeader.split(' ')[1];
        const user = await authService.verifyToken(token);

        // Attach user to request for route handlers
        (req as any).user = user;

        next();
    } catch (err: any) {
        res.status(401).json({ message: err.message || 'Unauthorized' });
    }
}
