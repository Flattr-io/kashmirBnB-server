import cron from 'node-cron';
import { AmadeusAuthService } from '../services/amadeus-auth.service';

export class AmadeusTokenScheduler {
    private auth: AmadeusAuthService;

    constructor() {
        this.auth = new AmadeusAuthService();
    }

    start() {
        // Refresh every 25 minutes to keep token warm (expires ~30m)
        cron.schedule('*/25 * * * *', async () => {
            try {
                await this.auth.refreshNow();
                console.log('[AmadeusTokenScheduler] Token refreshed');
            } catch (e: any) {
                console.error('[AmadeusTokenScheduler] Refresh failed:', e?.message || e);
            }
        });
    }
}


