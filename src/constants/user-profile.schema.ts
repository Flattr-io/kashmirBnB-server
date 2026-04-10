/**
 * Aligned with PostgreSQL `users` / `user_profiles` (see supabase/migrations).
 * Phone widened for E.164 (+ prefix + up to 15 digits).
 */
export const USER_PHONE_MAX_LEN = 32;
export const USER_FULL_NAME_MAX_LEN = 100;

/**
 * Phone.Email supplies `user_first_name` / `user_last_name` (JSON URL or JWT). Prefer explicit `full_name` from the client when sent.
 */
export function formatProfileFullName(params: {
    explicitFullName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    fallback?: string;
}): string {
    const { explicitFullName, firstName, lastName, fallback = 'User' } = params;
    if (explicitFullName?.trim()) {
        return explicitFullName.trim().slice(0, USER_FULL_NAME_MAX_LEN);
    }
    const parts = [firstName, lastName]
        .map((s) => (typeof s === 'string' ? s.trim() : ''))
        .filter((s) => s.length > 0);
    if (parts.length > 0) {
        return parts.join(' ').slice(0, USER_FULL_NAME_MAX_LEN);
    }
    return fallback.slice(0, USER_FULL_NAME_MAX_LEN);
}
