import createError from 'http-errors';
import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    if (createError.isHttpError(err)) {
        return res.status(err.status || 500).json({
            timestamp: Date.now(),
            status: err.status,
            message: err.message,
        });
    }

    console.error(err);

    res.status(500).json({
        timestamp: Date.now(),
        status: 500,
        message: 'Some error occurred. Please try again.',
    });
};
