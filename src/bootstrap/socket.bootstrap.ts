import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { ChatService } from '../services/chat.service';
import { AuthService } from '../services/auth.service';

//TODO: Move to shared types
interface CachedUserState {
    canSend: boolean;
    userState: string;
    name: string;
    variationId: number;
}

export class SocketBootstrap {
    private io: SocketIOServer;
    private chatService = new ChatService();
    private userStateCache = new Map<string, CachedUserState>();

    constructor(httpServer: HttpServer, corsOrigins: string | string[]) {
        this.io = new SocketIOServer(httpServer, {
            cors: {
                origin: corsOrigins,
                credentials: true,
            },
            connectionStateRecovery: {
                maxDisconnectionDuration: 2 * 60 * 1000,
                skipMiddlewares: true,
            },
        });

        this.setupEventHandlers();
    }

    private setupEventHandlers() {
        const chatService = new ChatService();
        const authService = new AuthService();

        this.io.on('connection', async (socket) => {
            console.log('A user connected', socket.id);

            // Extract Supabase access token (from client)
            const authHeader = socket.handshake.headers?.authorization;
            const token =
                socket.handshake.auth?.token ||
                (authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined);
            if (!token) {
                socket.emit('unauthorized', { error: 'Missing Supabase token' });
                socket.disconnect(true);
                console.log('User disconnected because of missing Supabase token');
                return;
            }

            // Verify token using Supabase backend SDK
            try {
                const user = await authService.verifyToken(token);
                socket.data.userId = user.id;
                socket.data.name = user.user_metadata.name;
            } catch (error) {
                console.error('Invalid Supabase token:', error);
                socket.emit('unauthorized', { error: 'Invalid token' });
                socket.disconnect(true);
                return;
            }

            const userId = socket.data.userId;
            const name = socket.data.name;

            // Fetch and cache user chat state
            const state = await this.chatService.getUserChatState(userId);

            if (!state.canSend || state.userState === 'UNAUTHENTICATED' || state.userState === 'PHONE_VERIFIED') {
                console.log('User is not KYC verified');
                socket.disconnect(true);
                return;
            }

            this.userStateCache.set(userId, {
                canSend: state.canSend,
                userState: state.userState,
                name: name, //TODO: Fix this. Get username from decoded token
                variationId: state.variationId,
            });

            socket.join('global-chat'); // Put the user in the global chat room
            console.log(`User ${userId} joined global chat`);

            socket.on('send-message', (data: { text: string }) => {
                if (!data?.text?.trim()) return;

                const cached = this.userStateCache.get(userId);
                if (!cached?.canSend) {
                    socket.emit('error-message', { error: 'You are not allowed to send messages.' });
                    return;
                }

                // Broadcast the message to all users EXCEPT the sender
                console.log('Sending message to global chat', data);
                socket.to('global-chat').emit('receive-message', {
                    text: data.text,
                    username: name, //TODO: Fix this with username
                    timestamp: new Date().toISOString(),
                    socketId: socket.id,
                });
                // Save message asynchronously
                this.chatService
                    .sendMessage(userId, data.text)
                    .catch((err) => console.error('Failed to save message:', err));
            });

            socket.on('disconnect', () => {
                console.log('User disconnected', socket.id);
                this.userStateCache.delete(userId);
            });
        });
    }
}
