import axios from 'axios';
import { SupabaseClient } from '@supabase/supabase-js';
import { getDB } from '../configuration/database.config';

type TokenRow = { provider: string; access_token: string; expires_at: string };

export class AmadeusAuthService {
    private static inMemoryToken: { token: string; expiresAt: number } | null = null;
    private get db(): SupabaseClient { return getDB(); }

    private get baseAuthUrl(): string {
        const host = (process.env.AMADEUS_HOSTNAME as string) || 'test';
        return host === 'production' ? 'https://api.amadeus.com' : 'https://test.api.amadeus.com';
    }

    async getAccessToken(): Promise<string> {
        const now = Date.now();
        if (AmadeusAuthService.inMemoryToken && AmadeusAuthService.inMemoryToken.expiresAt - now > 60_000) {
            return AmadeusAuthService.inMemoryToken.token;
        }

        // Try DB
        const { data } = await this.db
            .from('integration_tokens')
            .select('provider,access_token,expires_at')
            .eq('provider', 'amadeus')
            .maybeSingle();
        if (data) {
            const exp = new Date((data as TokenRow).expires_at).getTime();
            if (exp - now > 60_000) {
                AmadeusAuthService.inMemoryToken = { token: (data as TokenRow).access_token, expiresAt: exp };
                return (data as TokenRow).access_token;
            }
        }

        // Refresh
        return await this.refreshNow();
    }

    async refreshNow(): Promise<string> {
        const clientId = process.env.AMADEUS_CLIENT_ID as string;
        const clientSecret = process.env.AMADEUS_CLIENT_SECRET as string;
        const url = `${this.baseAuthUrl}/v1/security/oauth2/token`;
        const body = new URLSearchParams();
        body.set('grant_type', 'client_credentials');
        body.set('client_id', clientId);
        body.set('client_secret', clientSecret);

        const resp = await axios.post(url, body.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 10000,
        });
        const token = resp.data?.access_token as string;
        const expiresIn = Number(resp.data?.expires_in || 0); // seconds
        const expiresAt = new Date(Date.now() + Math.max(0, (expiresIn - 60)) * 1000); // 60s buffer

        // Cache in memory
        AmadeusAuthService.inMemoryToken = { token, expiresAt: expiresAt.getTime() };

        // Persist in DB
        await this.db
            .from('integration_tokens')
            .upsert({ provider: 'amadeus', access_token: token, expires_at: expiresAt.toISOString() })
            .select('provider');

        return token;
    }
}


