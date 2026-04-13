/**
 * Express 5 with @types/express v5 types `req.params` values as `string | string[]`.
 * Standard `:param` routes yield a string at runtime; normalize for service calls and DB queries.
 */
export function pathParam(value: string | string[] | undefined): string {
    if (value === undefined) {
        return '';
    }
    if (Array.isArray(value)) {
        return value[0] ?? '';
    }
    return value;
}
