# Secure Chat Application

A privacy-focused, end-to-end encrypted chat application built with Next.js, featuring WebRTC video calls and magic link authentication.

## Features

- **End-to-End Encryption**: All messages are encrypted client-side using AES-GCM before being sent to the server
- **Magic Link Authentication**: Passwordless authentication via email
- **WebRTC Video Calls**: Peer-to-peer video/voice calls with TURN/STUN support
- **Delete for Everyone**: Cryptographically signed delete requests
- **Zero-Knowledge Server**: Server only stores encrypted ciphertext, never plaintext

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes (Serverless Functions)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT-based sessions with magic links
- **Encryption**: WebCrypto API (AES-GCM, ECDSA, RSA-OAEP)
- **Real-time**: WebRTC with serverless signaling

## Prerequisites

- Node.js 20+
- PostgreSQL database
- SMTP server for magic links (or Resend API)
- TURN server for WebRTC (optional but recommended)

## Quick Start

### 1. Clone and Install

\`\`\`bash
git clone https://github.com/your-org/secure-chat.git
cd secure-chat
npm install
\`\`\`

### 2. Configure Environment

\`\`\`bash
cp .env.example .env.local
\`\`\`

Edit `.env.local` with your configuration:

\`\`\`env
DATABASE_URL="postgresql://user:password@localhost:5432/secure_chat"
JWT_SECRET="your-super-secret-jwt-key"
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="your-username"
SMTP_PASSWORD="your-password"
SMTP_FROM="noreply@yourapp.com"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_STUN_URL="stun:stun.l.google.com:19302"
NEXT_PUBLIC_TURN_URL="turn:your-turn-server.com:3478"
TURN_USERNAME="turn-user"
TURN_CREDENTIAL="turn-password"
\`\`\`

### 3. Setup Database

\`\`\`bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# (Optional) Open Prisma Studio
npm run db:studio
\`\`\`

### 4. Start Development Server

\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000)

## Vercel Deployment

### Step 1: Create Vercel Project

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import your repository
3. Vercel will auto-detect Next.js

### Step 2: Configure Environment Variables

In Vercel Dashboard → Project → Settings → Environment Variables, add:

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `JWT_SECRET` | Secret for signing JWTs (32+ chars) | Yes |
| `SMTP_HOST` | SMTP server hostname | Yes |
| `SMTP_PORT` | SMTP port (usually 587) | Yes |
| `SMTP_USER` | SMTP username | Yes |
| `SMTP_PASSWORD` | SMTP password | Yes |
| `SMTP_FROM` | From email address | Yes |
| `NEXT_PUBLIC_APP_URL` | Your app's public URL | Yes |
| `NEXT_PUBLIC_STUN_URL` | STUN server URL | Yes |
| `NEXT_PUBLIC_TURN_URL` | TURN server URL | Recommended |
| `TURN_USERNAME` | TURN server username | If using TURN |
| `TURN_CREDENTIAL` | TURN server password | If using TURN |

### Step 3: Setup Database

**Option A: Vercel Postgres**
1. Go to Storage tab in Vercel Dashboard
2. Create a new Postgres database
3. Connect it to your project (auto-adds `DATABASE_URL`)

**Option B: External Database (Neon, Supabase, etc.)**
1. Create a PostgreSQL database
2. Copy the connection string to `DATABASE_URL`

### Step 4: Run Migrations

After first deploy, run migrations:

\`\`\`bash
# Using Vercel CLI
vercel env pull .env.local
npx prisma migrate deploy
\`\`\`

Or use GitHub Actions (see `.github/workflows/ci.yml`)

### Step 5: Deploy

\`\`\`bash
# Deploy to production
vercel --prod

# Or push to main branch for auto-deploy
git push origin main
\`\`\`

## Project Structure

\`\`\`
├── app/
│   ├── api/
│   │   ├── auth/          # Authentication endpoints
│   │   ├── chats/         # Chat management
│   │   ├── messages/      # Message storage (ciphertext only)
│   │   ├── signal/        # WebRTC signaling
│   │   ├── delete/        # Delete control messages
│   │   └── health/        # Health check
│   ├── chat/[id]/         # Individual chat room
│   ├── chats/             # Chat list
│   ├── login/             # Authentication page
│   └── settings/          # User settings
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── chat-room.tsx      # Chat interface
│   ├── video-call.tsx     # WebRTC video call
│   └── ...
├── hooks/
│   ├── use-crypto.ts      # Encryption utilities
│   └── use-webrtc.ts      # WebRTC management
├── lib/
│   ├── auth.ts            # Authentication logic
│   ├── crypto.ts          # Standalone crypto utils
│   ├── db.ts              # Database client
│   └── delete-message.ts  # Delete verification
├── prisma/
│   └── schema.prisma      # Database schema
└── __tests__/             # Test files
\`\`\`

## Security Architecture

### Client-Side Encryption

1. **Key Generation**: Each user generates RSA-OAEP (encryption) and ECDSA (signing) key pairs
2. **Key Storage**: Private keys stored in IndexedDB, never sent to server
3. **Message Encryption**: AES-GCM with random IV per message
4. **Chat Keys**: Per-chat symmetric keys, encrypted with recipient's public key

### Server Behavior

- **Zero Knowledge**: Server only stores ciphertext and metadata
- **Relay Only**: No message decryption capability
- **Delete Verification**: Validates signatures but can't read content

### Delete for Everyone

1. Sender signs delete request with private key
2. Server relays to all participants
3. Recipients verify signature before deleting
4. Offline users receive on reconnect

## Testing

\`\`\`bash
# Run unit tests
npm test

# Run with coverage
npm run test:coverage

# Run integration tests (requires database)
npm run test:integration

# Watch mode
npm run test:watch
\`\`\`

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/magic` | POST | Send magic link email |
| `/api/auth/verify` | GET | Verify magic link token |
| `/api/auth/session` | GET/PUT/DELETE | Session management |
| `/api/chats` | GET/POST | List/create chats |
| `/api/messages` | GET/POST | Fetch/send encrypted messages |
| `/api/signal` | POST | WebRTC signaling |
| `/api/delete` | POST | Delete control message |
| `/api/health` | GET | Health check |

## Troubleshooting

### Common Issues

**Database connection fails**
- Verify `DATABASE_URL` is correct
- Check database is accessible from Vercel's network
- For Neon/Supabase, ensure SSL mode is configured

**Magic links not sending**
- Verify SMTP credentials
- Check spam folder
- Test with a service like Mailtrap first

**WebRTC calls not connecting**
- Ensure TURN server is configured for NAT traversal
- Check browser console for ICE connection errors
- Verify TURN credentials are correct

**Signaling timeouts**
- Serverless functions have 10s timeout
- Consider external WebSocket service for production

## Contributing

1. Fork the repository
2. Create a feature branch
3. Run tests and linting
4. Submit a pull request

## License

MIT License - see LICENSE file for details
