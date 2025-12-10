import jwt, { JwtPayload, VerifyOptions } from 'jsonwebtoken';
import { BadRequestError, UnauthorizedError } from '@hyperflake/http-errors';

type PhoneClaims = JwtPayload & {
    phone?: string;
    phone_number?: string;
    phoneNumber?: string;
    mobile?: string;
    mobile_number?: string;
    msisdn?: string;
    [key: string]: unknown;
};

export interface PhoneVerificationResult {
    phone: string;
    payload: PhoneClaims;
}

export class PhoneVerificationService {
    verifyPhoneToken(token: string): PhoneVerificationResult {
        if (!token || typeof token !== 'string') {
            throw new BadRequestError('verification token is required');
        }

        const apiKey = this.getApiKey();
        const verifyOptions = this.buildVerifyOptions();

        try {
            const payload = jwt.verify(token, apiKey, verifyOptions) as PhoneClaims;
            return { phone: payload.phone_no, payload };
        } catch (error: any) {
            if (error instanceof BadRequestError) {
                throw error;
            }

            const message =
                error?.name === 'TokenExpiredError' ? 'Verification token has expired' : 'Invalid verification token';

            throw new UnauthorizedError(message);
        }
    }

    private getApiKey(): string {
        const apiKey = process.env.PHONE_VERIFICATION_API_KEY;
        if (!apiKey) {
            throw new UnauthorizedError('Phone verification API key is missing');
        }
        return apiKey;
    }

    private buildVerifyOptions(): VerifyOptions {
        const options: VerifyOptions = {};
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
