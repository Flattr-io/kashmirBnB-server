import axios from 'axios';
import jwt, { JwtPayload, VerifyOptions } from 'jsonwebtoken';
import { BadRequestError, UnauthorizedError } from '@hyperflake/http-errors';
import { USER_FULL_NAME_MAX_LEN, USER_PHONE_MAX_LEN } from '../constants/user-profile.schema';

/**
 * Phone.Email (https://www.phone.email/docs-sign-in-with-phone)
 *
 * **Frontend (Web / React Native WebView):** Register in Phone.Email Admin Dashboard and embed their button
 * using the **Client ID** — that value is public (like an OAuth client id). It is not a server secret.
 *
 * **Backend (this API):**
 * - **JWT path:** Verify HS256 tokens with `PHONE_VERIFICATION_API_KEY` (API key from the same dashboard).
 * - **JSON URL path:** After OTP, their `phoneEmailListener` provides `user_json_url` (e.g. `https://user.phone.email/user_….json`).
 *   The backend must **GET** that URL and read `user_country_code`, `user_phone_number`, `user_first_name`, `user_last_name`
 *   (per official Node sample). Use `POST /api/auth/phone-email/sync-profile` with a Bearer session — do not expose the API key to the app.
 *
 * @see https://github.com/phoneemail/sign-in-with-phone-nodejs — `POST` body `user_json_url` + HTTP GET
 */
type PhoneJwtPayload = JwtPayload &
    Record<string, unknown> & {
        country_code?: string;
        phone_no?: string;
        user_country_code?: string;
        user_phone_number?: string;
        user_first_name?: string;
        user_last_name?: string;
        first_name?: string;
        last_name?: string;
        phone?: string;
        phone_number?: string;
        phoneNumber?: string;
    };

export interface PhoneVerificationResult {
    phone: string;
    payload: PhoneJwtPayload;
    /** Present when Phone.Email includes name claims in the JWT */
    first_name?: string;
    last_name?: string;
}

/** Parsed from Phone.Email user JSON (`user_json_url` response). */
export interface PhoneEmailJsonVerificationResult {
    phone: string;
    first_name?: string;
    last_name?: string;
}

export class PhoneVerificationService {
    verifyPhoneToken(token: string): PhoneVerificationResult {
        if (!token || typeof token !== 'string') {
            throw new BadRequestError('verification token is required');
        }

        const apiKey = this.getJwtSecretOrThrow();
        const verifyOptions = this.buildVerifyOptions();

        try {
            const payload = jwt.verify(token, apiKey, verifyOptions) as PhoneJwtPayload;
            const phone = this.extractPhoneFromClaims(payload);
            if (phone.length > USER_PHONE_MAX_LEN) {
                throw new BadRequestError(
                    `Verified phone exceeds maximum length (${USER_PHONE_MAX_LEN}) for storage; check provider payload format`
                );
            }
            const { first_name, last_name } = this.extractNameFromClaims(payload);
            return { phone, payload, first_name, last_name };
        } catch (error: any) {
            if (error instanceof BadRequestError) {
                throw error;
            }
            if (error instanceof UnauthorizedError) {
                throw error;
            }

            const message =
                error?.name === 'TokenExpiredError' ? 'Verification token has expired' : 'Invalid verification token';

            throw new UnauthorizedError(message);
        }
    }

    /**
     * Backend step from Phone.Email docs: GET `user_json_url` and parse verified phone + names.
     * Host allowlist prevents SSRF (defaults to `user.phone.email`).
     */
    async fetchVerifiedUserFromPhoneEmailJson(userJsonUrl: string): Promise<PhoneEmailJsonVerificationResult> {
        if (!userJsonUrl || typeof userJsonUrl !== 'string') {
            throw new BadRequestError('user_json_url is required');
        }
        const safeUrl = assertAllowedPhoneEmailUserJsonUrl(userJsonUrl).toString();
        try {
            const res = await axios.get<unknown>(safeUrl, {
                timeout: 15_000,
                maxRedirects: 3,
                validateStatus: (status) => status === 200,
            });
            return this.parsePhoneEmailUserJsonObject(res.data);
        } catch (e: any) {
            if (e instanceof BadRequestError) {
                throw e;
            }
            if (axios.isAxiosError(e)) {
                const status = e.response?.status;
                if (status === 404) {
                    throw new BadRequestError('Verification JSON not found or expired');
                }
                throw new BadRequestError('Failed to fetch Phone.Email verification JSON');
            }
            throw e;
        }
    }

    private parsePhoneEmailUserJsonObject(data: unknown): PhoneEmailJsonVerificationResult {
        if (!isPlainObject(data)) {
            throw new BadRequestError('Verification JSON must be an object');
        }
        const phone = extractPhoneFromFlatJson(data);
        if (phone.length > USER_PHONE_MAX_LEN) {
            throw new BadRequestError(
                `Verified phone exceeds maximum length (${USER_PHONE_MAX_LEN}); check Phone.Email payload`
            );
        }
        const first_name = pickTrimmedString(data, 'user_first_name');
        const last_name = pickTrimmedString(data, 'user_last_name');
        if (
            (first_name && first_name.length > USER_FULL_NAME_MAX_LEN) ||
            (last_name && last_name.length > USER_FULL_NAME_MAX_LEN)
        ) {
            throw new BadRequestError(`Name fields must be ${USER_FULL_NAME_MAX_LEN} characters or less`);
        }
        return { phone, first_name, last_name };
    }

    /**
     * Prefer Phone.Email’s documented pair (`country_code` + `phone_no`), then JSON-field aliases,
     * then a single combined claim if the provider only sends one string.
     */
    private extractPhoneFromClaims(payload: PhoneJwtPayload): string {
        const cc =
            pickTrimmedString(payload as Record<string, unknown>, 'country_code') ??
            pickTrimmedString(payload as Record<string, unknown>, 'user_country_code') ??
            '';
        const national =
            pickTrimmedString(payload as Record<string, unknown>, 'phone_no') ??
            pickTrimmedString(payload as Record<string, unknown>, 'user_phone_number') ??
            '';

        if (national) {
            const combined = `${cc}${national}`.trim();
            if (combined) {
                return combined;
            }
        }

        const single =
            pickTrimmedString(payload as Record<string, unknown>, 'phone') ??
            pickTrimmedString(payload as Record<string, unknown>, 'phone_number') ??
            pickTrimmedString(payload as Record<string, unknown>, 'phoneNumber');

        if (single) {
            return single;
        }

        throw new BadRequestError('Verification token payload does not contain a phone number');
    }

    private extractNameFromClaims(payload: PhoneJwtPayload): { first_name?: string; last_name?: string } {
        const rec = payload as Record<string, unknown>;
        const first_name =
            pickTrimmedString(rec, 'user_first_name') ??
            pickTrimmedString(rec, 'first_name') ??
            pickTrimmedString(rec, 'given_name');
        const last_name =
            pickTrimmedString(rec, 'user_last_name') ??
            pickTrimmedString(rec, 'last_name') ??
            pickTrimmedString(rec, 'family_name');
        return { first_name, last_name };
    }

    private getJwtSecretOrThrow(): string {
        const apiKey = process.env.PHONE_VERIFICATION_API_KEY;
        if (!apiKey) {
            throw new UnauthorizedError('Phone verification API key is missing (PHONE_VERIFICATION_API_KEY)');
        }
        return apiKey;
    }

    private buildVerifyOptions(): VerifyOptions {
        const options: VerifyOptions = {
            algorithms: ['HS256'],
        };
        const issuer = process.env.PHONE_VERIFICATION_ISSUER;
        const audience = process.env.PHONE_VERIFICATION_AUDIENCE;

        if (issuer) {
            options.issuer = issuer;
        }
        if (audience) {
            options.audience = audience;
        }

        return options;
    }
}

function extractPhoneFromFlatJson(data: Record<string, unknown>): string {
    const cc = pickTrimmedString(data, 'user_country_code') ?? '';
    const num = pickTrimmedString(data, 'user_phone_number') ?? '';
    if (num) {
        return `${cc}${num}`.trim();
    }
    const single =
        pickTrimmedString(data, 'user_phone') ?? pickTrimmedString(data, 'phone') ?? pickTrimmedString(data, 'phone_no');
    if (single) {
        return single.trim();
    }
    throw new BadRequestError('Verification JSON does not contain user_phone_number (or a single phone field)');
}

/** Default host per https://www.phone.email/docs-sign-in-with-phone — override with PHONE_EMAIL_ALLOWED_JSON_HOSTS=comma,separated */
function assertAllowedPhoneEmailUserJsonUrl(urlString: string): URL {
    let u: URL;
    try {
        u = new URL(urlString);
    } catch {
        throw new BadRequestError('Invalid user_json_url');
    }
    if (u.protocol !== 'https:') {
        throw new BadRequestError('user_json_url must use https');
    }
    const host = u.hostname.toLowerCase();
    const allowed = getAllowedPhoneEmailJsonHosts();
    if (!allowed.includes(host)) {
        throw new BadRequestError(`user_json_url host is not allowed: ${host}`);
    }
    return u;
}

function getAllowedPhoneEmailJsonHosts(): string[] {
    const raw =
        process.env.PHONE_EMAIL_ALLOWED_JSON_HOSTS?.trim() || 'user.phone.email';
    return raw
        .split(',')
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean);
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
    return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function pickTrimmedString(payload: Record<string, unknown>, key: string): string | undefined {
    const v = payload[key];
    if (typeof v !== 'string') {
        return undefined;
    }
    const t = v.trim();
    return t.length > 0 ? t : undefined;
}
