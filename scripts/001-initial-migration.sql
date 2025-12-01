-- Initial Migration for Secure Chat Application
-- Run this against your PostgreSQL database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatar" TEXT,
    "publicKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- Sessions table
CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "deviceInfo" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Session_token_key" ON "Session"("token");
CREATE INDEX IF NOT EXISTS "Session_token_idx" ON "Session"("token");
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");

-- Magic Links table
CREATE TABLE IF NOT EXISTS "MagicLink" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "MagicLink_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MagicLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "MagicLink_token_key" ON "MagicLink"("token");
CREATE INDEX IF NOT EXISTS "MagicLink_token_idx" ON "MagicLink"("token");

-- Chats table
CREATE TABLE IF NOT EXISTS "Chat" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "name" TEXT,
    "isGroup" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);

-- Chat Members table
CREATE TABLE IF NOT EXISTS "ChatMember" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "chatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "ChatMember_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ChatMember_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChatMember_chatId_userId_key" ON "ChatMember"("chatId", "userId");
CREATE INDEX IF NOT EXISTS "ChatMember_chatId_idx" ON "ChatMember"("chatId");
CREATE INDEX IF NOT EXISTS "ChatMember_userId_idx" ON "ChatMember"("userId");

-- Messages table (CIPHERTEXT ONLY)
CREATE TABLE IF NOT EXISTS "Message" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "chatId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'text',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "Message_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Message_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Message_chatId_createdAt_idx" ON "Message"("chatId", "createdAt");
CREATE INDEX IF NOT EXISTS "Message_senderId_idx" ON "Message"("senderId");

-- Signal Events table (WebRTC signaling)
CREATE TABLE IF NOT EXISTS "SignalEvent" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "chatId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    
    CONSTRAINT "SignalEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SignalEvent_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SignalEvent_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "SignalEvent_chatId_toUserId_consumed_idx" ON "SignalEvent"("chatId", "toUserId", "consumed");
CREATE INDEX IF NOT EXISTS "SignalEvent_expiresAt_idx" ON "SignalEvent"("expiresAt");

-- Delete Events table
CREATE TABLE IF NOT EXISTS "DeleteEvent" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "messageId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered" BOOLEAN NOT NULL DEFAULT false,
    
    CONSTRAINT "DeleteEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DeleteEvent_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DeleteEvent_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DeleteEvent_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "DeleteEvent_chatId_delivered_idx" ON "DeleteEvent"("chatId", "delivered");
CREATE INDEX IF NOT EXISTS "DeleteEvent_messageId_idx" ON "DeleteEvent"("messageId");

-- Cleanup function for expired signal events
CREATE OR REPLACE FUNCTION cleanup_expired_signals() RETURNS void AS $$
BEGIN
    DELETE FROM "SignalEvent" WHERE "expiresAt" < NOW();
END;
$$ LANGUAGE plpgsql;
