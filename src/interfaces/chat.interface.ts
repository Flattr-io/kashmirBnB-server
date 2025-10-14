export type UserState = 'UNAUTHENTICATED' | 'PHONE_VERIFIED' | 'KYC_VERIFIED';

export interface ChatMessageDTO {
    id: string;
    text: string;
    author: string;
    timestamp: string;
    isRigged: boolean;
}

export interface ChatResponseDTO {
    userState: UserState;
    canSend: boolean;
    messagesAvailable: number;
    messages: ChatMessageDTO[];
    error: string | null;
}

export interface CachedUserState {
    canSend: boolean;
    userState: UserState;
    name: string;
    variationId: number;
}

export interface RateLimitEntry {
    count: number;
    lastReset: number;
}
