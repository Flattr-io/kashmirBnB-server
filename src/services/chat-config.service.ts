export class ChatConfigService {
    static getConfig() {
        return {
            unauthenticatedLimit: Number(process.env.CHAT_UNAUTHENTICATED_LIMIT) || 10,
            phoneVerifiedLimit: Number(process.env.CHAT_PHONE_VERIFIED_LIMIT) || 50,
            maxVariations: Number(process.env.CHAT_MAX_VARIATIONS) || 5,
            retentionDays: Number(process.env.CHAT_MESSAGE_RETENTION_DAYS) || 30,
            riggedEnabled: process.env.CHAT_ENABLE_RIGGED === 'true',
        };
    }
}


