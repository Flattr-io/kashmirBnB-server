import { NextFunction, Request, Response } from 'express';
import createError from 'http-errors';
import { User } from '@supabase/supabase-js';

function extractUserFromRequest(req: Request): User | null {
    const user = (req as any).user as User | undefined;
    return user ?? null;
}

function getRolesFromUser(user: User): string[] {
    const appMeta: any = (user as any).app_metadata || {};
    const userMeta: any = (user as any).user_metadata || {};

    const rolesFromAppMeta = Array.isArray(appMeta.roles)
        ? appMeta.roles
        : appMeta.role
            ? [appMeta.role]
            : [];

    const rolesFromUserMeta = Array.isArray(userMeta.roles)
        ? userMeta.roles
        : userMeta.role
            ? [userMeta.role]
            : [];

    const roles = [...rolesFromAppMeta, ...rolesFromUserMeta]
        .filter(Boolean)
        .map((r: string) => String(r).toLowerCase());

    return Array.from(new Set(roles));
}

export function requireRoles(...allowedRoles: string[]) {
    const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());

    return (req: Request, res: Response, next: NextFunction) => {
        const user = extractUserFromRequest(req);
        if (!user) {
            return next(createError(401, 'Unauthorized'));
        }

        if (normalizedAllowed.length === 0) {
            // If no roles provided, treat as misconfiguration
            return next(createError(500, 'Authorization misconfigured: no roles specified'));
        }

        const userRoles = getRolesFromUser(user);
        const isAllowed = userRoles.some((r) => normalizedAllowed.includes(r));
        if (!isAllowed) {
            return next(createError(403, 'Forbidden'));
        }

        return next();
    };
}

export function requirePredicate(predicate: (user: User) => boolean) {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = extractUserFromRequest(req);
        if (!user) {
            return next(createError(401, 'Unauthorized'));
        }

        try {
            const ok = predicate(user);
            if (!ok) {
                return next(createError(403, 'Forbidden'));
            }
            return next();
        } catch (e: any) {
            return next(createError(500, e?.message || 'Authorization predicate failed'));
        }
    };
}

export function requireSelfOrRoles(paramKey: string, ...allowedRoles: string[]) {
    const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());

    return (req: Request, res: Response, next: NextFunction) => {
        const user = extractUserFromRequest(req);
        if (!user) {
            return next(createError(401, 'Unauthorized'));
        }

        const requestedId = String((req.params as any)[paramKey] ?? '');
        if (requestedId && requestedId === user.id) {
            return next();
        }

        if (normalizedAllowed.length === 0) {
            return next(createError(403, 'Forbidden'));
        }

        const userRoles = getRolesFromUser(user);
        const isAllowed = userRoles.some((r) => normalizedAllowed.includes(r));
        if (!isAllowed) {
            return next(createError(403, 'Forbidden'));
        }
        return next();
    };
}


