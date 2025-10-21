import { Socket, Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { ChatService } from '../services/chat.service';
import { AuthService } from '../services/auth.service';
import { CachedUserState } from '../interfaces/chat.interface';
import { RateLimitEntry } from '../interfaces/chat.interface';

export class SocketBootstrap {
    private io: SocketIOServer;
    private chatService = new ChatService();
    private authService = new AuthService();
    private userStateCache = new Map<string, CachedUserState>();
    private rateLimitCache = new Map<string, RateLimitEntry>();

    // Rate limit configuration
    private readonly MESSAGE_LIMIT = 5; // messages
    private readonly TIME_WINDOW = 10 * 1000; // 10 seconds

    constructor(httpServer: HttpServer, corsOrigins: string | string[]) {
        this.io = new SocketIOServer(httpServer, {
            cors: {
                origin: corsOrigins,
                credentials: true,
            },
            connectionStateRecovery: {
                maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
                skipMiddlewares: true,
            },
        });

        this.setupEventHandlers();
    }

    private setupEventHandlers() {
        this.io.on('connection', async (socket) => {
            console.log('A user connected', socket.id);
            // Extract Supabase access token from client
            const token = this.extractToken(socket);
            if (!token) return this.disconnectWithError(socket, 'Missing access token');

            // Verify token using Supabase backend SDK
            const user = await this.verifyUser(socket, token);
            if (!user) return;

            const userId = user.id;
            const fullName = user.user_metadata.full_name;

            // Fetch and cache user chat state
            const state = await this.fetchAndCacheUserState(socket, userId, fullName);
            if (!state) return;

            // Put the authenticated user in the global chat room
            socket.join('global-chat');
            console.log(`${socket.id} joined global chat`);

            // Handle chat messages
            this.registerChatHandlers(socket, userId, fullName);

            // Handle disconnection
            socket.on('disconnect', () => {
                console.log('User disconnected', socket.id);
                this.userStateCache.delete(userId);
            });
        });
    }

    private extractToken(socket: Socket): string | undefined {
        const authHeader = socket.handshake.headers?.authorization;
        return (
            socket.handshake.auth?.token || (authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined)
        );
    }

    private async verifyUser(socket: Socket, token: string) {
        try {
            const user = await this.authService.verifyToken(token);
            socket.data.userId = user.id;
            socket.data.fullName = user.user_metadata.full_name;
            return user;
        } catch (error) {
            console.error('Invalid access token:', error);
            this.disconnectWithError(socket, 'Invalid access token');
            return null;
        }
    }

    private async fetchAndCacheUserState(socket: Socket, userId: string, fullName: string) {
        try {
            const state = await this.chatService.getUserChatState(userId);

            if (!state.canSend || ['UNAUTHENTICATED', 'PHONE_VERIFIED'].includes(state.userState)) {
                console.warn(`User ${userId} is not KYC verified`);
                socket.disconnect(true);
                return null;
            }

            const cachedState: CachedUserState = {
                canSend: state.canSend,
                userState: state.userState,
                name: fullName,
                variationId: state.variationId,
            };

            this.userStateCache.set(userId, cachedState);
            return cachedState;
        } catch (error) {
            console.error('Failed to fetch user chat state:', error);
            socket.disconnect(true);
            return null;
        }
    }

    private checkRateLimit(userId: string): boolean {
        const now = Date.now();
        const entry = this.rateLimitCache.get(userId);

        if (!entry) {
            this.rateLimitCache.set(userId, { count: 1, lastReset: now });
            return true;
        }

        const elapsed = now - entry.lastReset;

        if (elapsed > this.TIME_WINDOW) {
            // Reset window
            entry.count = 1;
            entry.lastReset = now;
            return true;
        }

        if (entry.count < this.MESSAGE_LIMIT) {
            entry.count++;
            return true;
        }

        return false; // Rate limit exceeded
    }

    private registerChatHandlers(socket: Socket, userId: string, fullName: string) {
        socket.on('send-message', async ({ text }: { text: string }) => {
            if (!text?.trim()) return;

            const cached = this.userStateCache.get(userId);
            if (!cached?.canSend) {
                socket.emit('error-message', { error: 'You are not allowed to send messages.' });
                return;
            }

            if (!this.checkRateLimit(userId)) {
                console.log('Rate limit exceeded');
                socket.emit('error-message', {
                    error: 'You are sending messages too quickly. Please wait a few seconds.',
                });
                return;
            }

            const timestamp = new Date().toISOString();
            const message = {
                text,
                username: fullName, // TODO: Replace with username when available
                timestamp,
                socketId: socket.id,
            };

            try {
                await this.saveMessageWithRetry(userId, fullName, text);
                socket.to('global-chat').emit('receive-message', message);
                socket.emit('message-sent', message); // optional
            } catch (err) {
                console.error('Failed to save message:', err);
                socket.emit('error-message', { error: 'Failed to save your message.' });
            }
        });
    }

    private async saveMessageWithRetry(userId: string, fullName: string, text: string, retries = 3) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const { error } = await this.chatService.saveMessage(userId, fullName, text);
                if (error) throw error;
                return; // success
            } catch (err: any) {
                console.warn(`[Attempt ${attempt}/${retries}] Save failed:`, err.message);
                if (attempt === retries) throw err; // give up after max retries
                await new Promise((res) => setTimeout(res, 500 * attempt)); // backoff delay
            }
        }
        throw new Error('Failed to save message after retries');
    }

    private disconnectWithError(socket: Socket, message: string) {
        socket.emit('unauthorized', { error: message });
        socket.disconnect(true);
        console.log(`Disconnected socket (${socket.id}): ${message}`);
    }
}
