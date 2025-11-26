## Chat Socket API

This document explains how to connect to the real-time global chat that is powered by Socket.IO inside `src/bootstrap/socket.bootstrap.ts`. Use it alongside the Swagger docs for the REST endpoints (e.g. `GET /chat/messages`).

### Connection URL

- Local: `http://localhost:<PORT>/socket.io/`
- Production: `https://kashmirbnbserver-4vgs.onrender.com/socket.io/`

The Socket.IO client library automatically appends `/socket.io/` to the host, so typical usage looks like:

```javascript
import { io } from 'socket.io-client';

const socket = io('https://kashmirbnbserver-4vgs.onrender.com', {
  transports: ['websocket'],
  extraHeaders: { Authorization: `Bearer ${accessToken}` },
  auth: { token: accessToken }, // optional duplicate for mobile clients
});
```

### Authentication & Eligibility

1. Obtain a Supabase access token by completing the Google OAuth flow (`/auth/google-login` ➜ `/auth/callback`).
2. Pass the token either through `Authorization: Bearer <token>` header **or** `auth.token` during the Socket.IO handshake.
3. The backend verifies the token with Supabase and loads the caller's chat state via `ChatService.getUserChatState`.
4. Only users with `userState === "KYC_VERIFIED"` and `canSend === true` remain connected. Others are disconnected immediately with the `unauthorized` event, ensuring the send pipeline mirrors the `chat.messages` REST permissions.

### Rooms & Flow

- Every verified user is placed in the `global-chat` room.
- Messages are stored in the `chat_messages` table with `author_username`, `user_id`, timestamps, and a `is_rigged` flag.
- On disconnect the cached user state is cleared.

### Events

| Direction | Event            | Payload schema                              | Notes                                                                 |
|-----------|------------------|---------------------------------------------|-----------------------------------------------------------------------|
| Client → Server | `send-message`   | `{ text: string }` (see `ChatSocketSendPayload`) | Requires non-empty text. The server trims and rate-limits requests.   |
| Server → Client | `receive-message`| `ChatSocketMessage`                       | Broadcast to everyone in `global-chat` except the sender.             |
| Server → Client | `message-sent`   | `ChatSocketMessage`                       | Echo to the sender so UIs can confirm delivery.                       |
| Server → Client | `error-message`  | `ChatSocketError`                         | Emitted on validation issues or persistence failures.                 |
| Server → Client | `unauthorized`   | `ChatSocketError`                         | Sent just before the server disconnects a socket for auth issues.     |

Refer to `components.schemas` in `src/bootstrap/swagger.ts` for the exact field-level documentation of the socket payloads.

### Rate limiting

- Max **5 messages every 10 seconds** per user (`MESSAGE_LIMIT` and `TIME_WINDOW` in `SocketBootstrap`).
- When the limit is exceeded the server emits `error-message` with `"You are sending messages too quickly..."`.

### Failure scenarios

- **Missing/invalid token** ➜ `unauthorized` then disconnect.
- **Not KYC verified** ➜ `unauthorized` then disconnect.
- **Persistence failure** ➜ `error-message` but the socket stays connected.
- **Idle disconnects** ➜ Socket.IO default behavior; client can auto-reconnect with the same token.

