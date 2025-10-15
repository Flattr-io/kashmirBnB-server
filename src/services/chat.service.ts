import { SupabaseClient } from '@supabase/supabase-js';
import { getDB } from '../configuration/database.config';
import { ChatConfigService } from './chat-config.service';
import { ChatResponseDTO } from '../interfaces/chat.interface';
import { ChatMessageDTO } from '../interfaces/chat.interface';
import { UserState } from '../interfaces/chat.interface';

export class ChatService {
    private get db(): SupabaseClient {
        return getDB();
    }

    async getChatMessages(userId?: string): Promise<ChatResponseDTO> {
        const state = await this.getUserChatState(userId);
        console.log('state', state);

        const { userState, canSend, messagesAvailable, variationId } = state;

        let query = this.db.from('chat_messages').select('*');
        let limit: number | null = null;

        if (userState === 'KYC_VERIFIED') {
            // KYC users get everything, no limit
            query = query.order('created_at', { ascending: false });
        } else {
            // Unauthenticated or Phone Verified users → only rigged messages
            query = query
                .eq('is_rigged', true)
                .eq('variation_id', variationId)
                .order('created_at', { ascending: false });
            limit = messagesAvailable;
        }

        if (limit) {
            query = query.limit(limit);
        }

        const { data, error } = await query;

        if (error) {
            return {
                userState,
                canSend,
                messagesAvailable,
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
            userState,
            canSend,
            messagesAvailable,
            messages,
            error: null,
        };
    }

    async saveMessage(userId: string, name: string, text: string): Promise<{ success: boolean; error?: string }> {
        // const state = await this.getUserChatState(userId);
        // if (!state.canSend) {
        //     return { error: 'Not allowed' };
        // }

        // Ensure user has a chat username
        // const author = await this.ensureUserHasUsername(userId);

        try {
            const { error } = await this.db
                .from('chat_messages')
                .insert([{ text, author_username: name, user_id: userId, is_rigged: false }]);

            if (error) {
                return { success: false, error: 'Failed to save message' };
            }

            return { success: true };
        } catch (err) {
            console.error('Error saving message:', err);
            return { success: false, error: 'Unexpected error occurred' };
        }
    }

    async getUserChatState(userId?: string): Promise<{
        userState: UserState;
        canSend: boolean;
        messagesAvailable: number;
        variationId: number;
    }> {
        const config = ChatConfigService.getConfig();

        // Unauthenticated user
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
            messagesAvailable: isKycVerified
                ? Infinity // not used, but could be ignored
                : isPhoneVerified
                  ? config.phoneVerifiedLimit
                  : config.unauthenticatedLimit,
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
