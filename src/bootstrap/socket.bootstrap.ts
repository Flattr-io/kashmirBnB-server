import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { ChatService } from '../services/chat.service';
import { AuthService } from '../services/auth.service';

//TODO: Move to shared types
interface CachedUserState {
    canSend: boolean;
    userState: string;
    username: string;
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
            const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
            if (!token) {
                // socket.emit('unauthorized', { error: 'Missing Supabase token' });
                // await new Promise((resolve) => setTimeout(resolve, 1000));
                socket.disconnect(true);
                console.log('User disconnected because of missing Supabase token');
                return;
            }

            // Verify token using Supabase backend SDK
            const user = await authService.verifyToken(token);
            if (!user) {
                console.error('Invalid Supabase token:');
                // socket.emit('unauthorized', { error: 'Invalid Supabase token' });
                // await new Promise((resolve) => setTimeout(resolve, 1000));
                socket.disconnect(true);
                return;
            }

            const userId = user.id;
            socket.data.userId = userId; 

            // Fetch and cache user chat state
            const state = await this.chatService.getUserChatState(userId);
            // const username = await this.chatService.ensureUserHasUsername(userId);
            //TODO: Instead of using chatService, use the decoded token to get the user state and username

            this.userStateCache.set(userId, {
                canSend: state.canSend,
                userState: state.userState,
                username: 'Anonymous', //TODO: Fix this. Get username from decoded token
                variationId: state.variationId,
            });

            socket.join('global-chat'); // Put the user in the global chat room
            console.log(`User ${userId} joined global chat`);

            socket.on('send-message', (data: { text: string; username?: string }) => {
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
                    username: data.username || 'Anonymous', //TODO: Fix this
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
