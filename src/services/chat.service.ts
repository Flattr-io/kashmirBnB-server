import { SupabaseClient } from '@supabase/supabase-js';
import { getDB } from '../configuration/database.config';
import { ChatConfigService } from './chat-config.service';

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

export class ChatService {
    private get db(): SupabaseClient {
        return getDB();
    }

    async getChatMessages(userId?: string): Promise<ChatResponseDTO> {
        const state = await this.getUserChatState(userId);
        // Example result:
        // {
        //   userState: 'PHONE_VERIFIED',
        //   canSend: false,
        //   messagesAvailable: 100,
        //   variationId: 2
        // }

        // Fetch rigged (by variation) + real messages together, newest first
        const limit = state.messagesAvailable;
        const variationId = state.variationId;
        const { data, error } = await this.db
            .from('chat_messages')
            .select('*')
            .or(`is_rigged.eq.false,and(is_rigged.eq.true,variation_id.eq.${variationId})`)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            return {
                userState: state.userState,
                canSend: state.canSend,
                messagesAvailable: state.messagesAvailable,
                messages: [],
                error: 'Data fetch failed',
            };
        }

        const messages: ChatMessageDTO[] = (data || []).map((m: any) => ({
            id: m.id,
            text: m.text,
            author: m.author_username,
            timestamp: m.created_at,
            isRigged: !!m.is_rigged,
        }));

        return {
            userState: state.userState,
            canSend: state.canSend,
            messagesAvailable: state.messagesAvailable,
            messages,
            error: null,
        };
    }

    async sendMessage(userId: string, name: string, text: string): Promise<ChatResponseDTO | { error: string }> {
        // const state = await this.getUserChatState(userId);
        // if (!state.canSend) {
        //     return { error: 'Not allowed' };
        // }

        // Ensure user has a chat username
        // const author = await this.ensureUserHasUsername(userId);

        const { error } = await this.db
            .from('chat_messages')
            .insert([{ text, author_username: name, user_id: userId, is_rigged: false }]);

        if (error) {
            return { error: 'Data fetch failed' };
        }

        // Return updated chat view for the user
        return this.getChatMessages(userId);
    }

    async getUserChatState(userId?: string): Promise<{
        userState: UserState;
        canSend: boolean;
        messagesAvailable: number;
        variationId: number;
    }> {
        const config = ChatConfigService.getConfig();

        if (!userId) {
            return {
                userState: 'UNAUTHENTICATED',
                canSend: false,
                messagesAvailable: config.unauthenticatedLimit,
                variationId: this.getAnonymousVariation(config.maxVariations),
            };
        }

        const { data: profile } = await this.db
            .from('user_profiles')
            .select('verification_status, kyc_status, chat_variation_id')
            .eq('id', userId)
            .single();

        const isPhoneVerified = profile?.verification_status === 'verified';
        const isKycVerified = profile?.kyc_status === 'verified';

        return {
            userState: isKycVerified ? 'KYC_VERIFIED' : isPhoneVerified ? 'PHONE_VERIFIED' : 'UNAUTHENTICATED',
            canSend: !!isKycVerified,
            messagesAvailable: isPhoneVerified ? config.phoneVerifiedLimit : config.unauthenticatedLimit,
            variationId: profile?.chat_variation_id || 1,
        };
    }

    private getAnonymousVariation(max: number): number {
        // Deterministic hook could be added later; random for now
        return Math.max(1, Math.floor(Math.random() * max) + 1);
    }

    async ensureUserHasUsername(userId: string): Promise<string> {
        const { data: profile } = await this.db.from('user_profiles').select('chat_username').eq('id', userId).single();

        if (profile?.chat_username) return profile.chat_username;

        // Generate simple reddit-style username
        const base = `user_${Math.floor(Math.random() * 100000)}`;
        let username = base;
        let attempt = 0;
        while (attempt < 5) {
            const { data } = await this.db
                .from('user_profiles')
                .select('id')
                .eq('chat_username', username)
                .maybeSingle();
            if (!data) break;
            username = `${base}_${attempt + 1}`;
            attempt++;
        }

        await this.db.from('user_profiles').update({ chat_username: username }).eq('id', userId);
        return username;
    }
}
