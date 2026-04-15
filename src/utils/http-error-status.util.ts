/**
 * @hyperflake/http-errors uses `status`; some code uses `statusCode`. Normalize for Express handlers.
 */
export function getErrorHttpStatus(err: unknown, fallback = 500): number {
    if (err && typeof err === 'object') {
        const e = err as { status?: number; statusCode?: number };
        if (typeof e.status === 'number' && e.status >= 400 && e.status <= 599) {
            return e.status;
        }
        if (typeof e.statusCode === 'number' && e.statusCode >= 400 && e.statusCode <= 599) {
            return e.statusCode;
        }
    }
    return fallback;
}
