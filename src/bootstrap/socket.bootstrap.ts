import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { ChatService } from '../services/chat.service';

export class SocketBootstrap {
    private io: SocketIOServer;

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
        this.io.on('connection', (socket) => {
            socket.join('global-chat');

            socket.on('get-chat-history', async (callback: (response: any) => void) => {
                try {
                    const userId = (socket.handshake.auth && (socket.handshake.auth as any).userId) as string | undefined;
                    const response = await chatService.getChatMessages(userId);
                    callback(response);
                } catch (e) {
                    callback({ error: 'Data fetch failed' });
                }
            });

            socket.on('send-message', async (data: { text: string }, callback: (response: any) => void) => {
                try {
                    const userId = (socket.handshake.auth && (socket.handshake.auth as any).userId) as string | undefined;
                    if (!userId) return callback({ error: 'Not allowed' });
                    const response = await chatService.sendMessage(userId, data?.text);
                    callback(response);
                    if (!(response as any).error) {
                        // Broadcast updated view or just the new message list
                        this.io.to('global-chat').emit('chat:update');
                    }
                } catch (e) {
                    callback({ error: 'Data fetch failed' });
                }
            });
        });
    }
}