# Architecture Documentation

## High-Level System Overview

\`\`\`
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENT SIDE                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │  Next.js    │  │  WebCrypto  │  │  IndexedDB  │  │    WebRTC       │ │
│  │  Frontend   │  │  (E2EE)     │  │  (Keys)     │  │  (P2P Calls)    │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘ │
│         │                │                │                   │          │
└─────────┼────────────────┼────────────────┼───────────────────┼──────────┘
          │                │                │                   │
          ▼                ▼                ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        VERCEL SERVERLESS                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │  /api/auth  │  │ /api/messages│  │ /api/signal │  │  /api/delete   │ │
│  │  (JWT+Magic)│  │ (Ciphertext) │  │ (ICE Relay) │  │  (Signed Del)  │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘ │
│         │                │                │                   │          │
└─────────┼────────────────┼────────────────┼───────────────────┼──────────┘
          │                │                │                   │
          ▼                ▼                ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL SERVICES                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │ PostgreSQL  │  │    SMTP     │  │ TURN/STUN   │  │ (Optional)      │ │
│  │ (Metadata)  │  │  (Email)    │  │  Server     │  │ Redis/Realtime  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
\`\`\`

## Component Breakdown

### 1. Next.js Frontend

The React application handles:
- User interface rendering
- Local state management
- Encryption/decryption orchestration
- WebRTC peer connection management

### 2. Vercel Serverless Functions

| Function | Purpose | Timeout |
|----------|---------|---------|
| `/api/auth/*` | Magic link auth, session management | 10s |
| `/api/messages` | Store/retrieve encrypted messages | 30s |
| `/api/signal` | WebRTC offer/answer/ICE relay | 10s |
| `/api/delete` | Process signed delete requests | 10s |
| `/api/chats` | Chat room management | 15s |

### 3. PostgreSQL Database

Stores only:
- User accounts (email, public keys)
- Session tokens
- Chat metadata (participants, timestamps)
- Encrypted message blobs (ciphertext + IV)
- Delete events (for offline sync)

**Never stores**: Plaintext messages, private keys, decrypted content

### 4. External Services

| Service | Purpose | Recommendation |
|---------|---------|----------------|
| PostgreSQL | Primary database | Vercel Postgres, Neon, Supabase |
| SMTP | Magic link emails | Resend, SendGrid, AWS SES |
| TURN/STUN | NAT traversal for WebRTC | Twilio, Xirsys, self-hosted |
| Redis (Optional) | Signaling state cache | Upstash |
| Realtime (Optional) | WebSocket fallback | Pusher, Ably, Supabase Realtime |

## Encryption Flow

\`\`\`
┌──────────────────────────────────────────────────────────────────────┐
│                         MESSAGE ENCRYPTION                            │
│                                                                       │
│  1. User types message                                                │
│     │                                                                 │
│     ▼                                                                 │
│  2. Generate random AES-GCM key (per-chat, first message)            │
│     │                                                                 │
│     ▼                                                                 │
│  3. Encrypt message with AES-GCM + random IV                         │
│     │                                                                 │
│     ▼                                                                 │
│  4. Send to server: { ciphertext, iv, chatId }                       │
│     │                                                                 │
│     ▼                                                                 │
│  5. Server stores ciphertext (no decryption capability)              │
│     │                                                                 │
│     ▼                                                                 │
│  6. Recipient fetches ciphertext                                      │
│     │                                                                 │
│     ▼                                                                 │
│  7. Decrypt with shared chat key from IndexedDB                       │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
\`\`\`

## Key Management

\`\`\`
┌──────────────────────────────────────────────────────────────────────┐
│                           KEY HIERARCHY                               │
│                                                                       │
│  Identity Keys (per user, long-lived)                                │
│  ├── RSA-OAEP Key Pair (for key exchange)                            │
│  │   ├── Public Key → stored on server, shared with contacts         │
│  │   └── Private Key → stored in IndexedDB, never leaves device      │
│  │                                                                    │
│  └── ECDSA Key Pair (for signing)                                    │
│      ├── Public Key → stored on server for verification              │
│      └── Private Key → stored in IndexedDB, signs delete requests    │
│                                                                       │
│  Chat Keys (per conversation, rotatable)                             │
│  └── AES-256-GCM → shared between participants                       │
│      ├── Encrypted with recipient's RSA public key                   │
│      └── Stored encrypted on server, decrypted locally               │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
\`\`\`

## WebRTC Signaling on Serverless

### Challenge
Vercel serverless functions are stateless with 10-30s timeouts. Traditional WebSocket-based signaling doesn't work.

### Solution: HTTP Polling with State Store

\`\`\`
┌─────────┐         ┌─────────────┐         ┌─────────┐
│ Caller  │         │ /api/signal │         │ Callee  │
└────┬────┘         └──────┬──────┘         └────┬────┘
     │                     │                     │
     │ POST offer          │                     │
     │────────────────────>│                     │
     │                     │ Store in DB/Redis   │
     │                     │─────────────────────>
     │                     │                     │
     │                     │     Poll for offer  │
     │                     │<────────────────────│
     │                     │                     │
     │                     │ Return offer        │
     │                     │────────────────────>│
     │                     │                     │
     │                     │     POST answer     │
     │                     │<────────────────────│
     │                     │                     │
     │   Poll for answer   │                     │
     │<────────────────────│                     │
     │                     │                     │
     │      Exchange ICE candidates              │
     │<─────────────────────────────────────────>│
     │                     │                     │
     │      Direct P2P connection established    │
     │<═════════════════════════════════════════>│
\`\`\`

### Signaling Endpoint Design

\`\`\`typescript
POST /api/signal
{
  "type": "offer" | "answer" | "ice-candidate",
  "chatId": "chat-123",
  "targetUserId": "user-456",
  "payload": { /* SDP or ICE candidate */ }
}

GET /api/signal?chatId=xxx&since=timestamp
→ Returns pending signals for authenticated user
\`\`\`

### Limitations & Workarounds

| Limitation | Impact | Workaround |
|------------|--------|------------|
| 10s function timeout | Can't hold connections | HTTP polling every 1-2s |
| No persistent state | Signals may be lost | Store in DB or Redis |
| Cold starts | Latency spikes | Keep functions warm |
| No WebSockets | Can't push to client | Client polls for updates |

### Production Recommendations

For production use with many concurrent calls:

1. **Use External Realtime Service**
   - Pusher, Ably, or Supabase Realtime
   - WebSocket support with global edge
   - Sub-100ms latency

2. **Redis for Signal State**
   - Upstash (serverless Redis)
   - 60s TTL for signals
   - Faster than database

3. **Dedicated Signaling Server**
   - Small Node.js server on Railway/Fly.io
   - WebSocket support
   - ~$5/month

## Delete for Everyone Protocol

\`\`\`
┌──────────────────────────────────────────────────────────────────────┐
│                     DELETE CONTROL MESSAGE                            │
│                                                                       │
│  {                                                                    │
│    "type": "delete",                                                  │
│    "messageId": "msg-uuid-123",                                       │
│    "chatId": "chat-uuid-456",                                         │
│    "senderId": "user-uuid-789",                                       │
│    "timestamp": 1699999999999,                                        │
│    "signature": "base64-ecdsa-signature"                              │
│  }                                                                    │
│                                                                       │
│  Signature covers: JSON.stringify({ messageId, chatId, senderId,      │
│                                     timestamp })                      │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
\`\`\`

### Flow

1. **Sender** creates delete request, signs with ECDSA private key
2. **Server** validates:
   - User is authenticated
   - User is original message sender
   - Stores delete event for offline users
3. **Online Recipients** receive via polling, verify signature, delete locally
4. **Offline Recipients** receive delete events on next sync

### Edge Cases

| Scenario | Handling |
|----------|----------|
| Recipient offline | Server stores delete event, delivered on reconnect |
| Message already deleted | Idempotent - no error |
| Invalid signature | Reject, log security event |
| Sender not original author | Reject with 403 |
| Device compromised | Implement device verification + force logout |

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection | `postgresql://...` |
| `JWT_SECRET` | JWT signing secret | `openssl rand -base64 32` |
| `SMTP_HOST` | Mail server | `smtp.resend.com` |
| `SMTP_PORT` | Mail port | `587` |
| `SMTP_USER` | Mail username | `resend` |
| `SMTP_PASSWORD` | Mail password | `re_xxx` |
| `SMTP_FROM` | From address | `noreply@app.com` |
| `NEXT_PUBLIC_APP_URL` | App base URL | `https://app.com` |

### WebRTC

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_STUN_URL` | STUN server | `stun:stun.l.google.com:19302` |
| `NEXT_PUBLIC_TURN_URL` | TURN server | `turn:turn.example.com:3478` |
| `TURN_USERNAME` | TURN auth | `user123` |
| `TURN_CREDENTIAL` | TURN password | `pass456` |

### Optional

| Variable | Description | Example |
|----------|-------------|---------|
| `REDIS_URL` | Signal state cache | `redis://...` |
| `SENTRY_DSN` | Error monitoring | `https://xxx@sentry.io/xxx` |
| `PUSHER_*` | Realtime service | Various |

## Deployment Checklist

### Pre-Deployment

- [ ] Generate secure `JWT_SECRET` (32+ characters)
- [ ] Configure PostgreSQL database
- [ ] Setup SMTP provider
- [ ] (Recommended) Setup TURN server

### Vercel Configuration

- [ ] Import project from GitHub
- [ ] Add all environment variables
- [ ] Configure custom domain (if applicable)
- [ ] Enable Vercel Analytics

### Post-Deployment

- [ ] Run database migrations
- [ ] Test magic link flow
- [ ] Test message encryption/decryption
- [ ] Test WebRTC calling (with TURN)
- [ ] Setup monitoring (Sentry, etc.)

### Production Hardening

- [ ] Enable rate limiting
- [ ] Configure CSP headers
- [ ] Setup database backups
- [ ] Implement device verification
- [ ] Add security audit logging

## Recommended Third-Party Services

### Database
- **Vercel Postgres** - Zero config, integrated
- **Neon** - Serverless, branching, generous free tier
- **Supabase** - Full platform, realtime included

### Email
- **Resend** - Developer-focused, great DX
- **SendGrid** - Enterprise-grade
- **AWS SES** - Cost-effective at scale

### TURN Servers
- **Twilio STUN/TURN** - Reliable, global
- **Xirsys** - WebRTC-focused
- **Coturn (self-hosted)** - Free, requires server

### Realtime (Optional)
- **Pusher** - Simple, reliable
- **Ably** - Enterprise features
- **Supabase Realtime** - If using Supabase

### Monitoring
- **Sentry** - Error tracking
- **Vercel Analytics** - Performance
- **LogTail** - Log aggregation
