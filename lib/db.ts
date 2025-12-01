// Mock database for v0 preview - in production, replace with real Prisma client
// This simulates the database operations using in-memory storage

export interface User {
  id: string
  email: string
  passwordHash: string | null
  name: string | null
  avatar: string | null
  publicKey: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Session {
  id: string
  userId: string
  token: string
  deviceInfo: string | null
  expiresAt: Date
  createdAt: Date
  user?: User
}

export interface MagicLink {
  id: string
  userId: string
  token: string
  used: boolean
  expiresAt: Date
  createdAt: Date
  user?: User
}

export interface Chat {
  id: string
  name: string | null
  isGroup: boolean
  createdAt: Date
  updatedAt: Date
  members?: ChatMember[]
  messages?: Message[]
}

export interface ChatMember {
  id: string
  chatId: string
  userId: string
  role: string
  joinedAt: Date
  user?: User
}

export interface Message {
  id: string
  chatId: string
  senderId: string
  ciphertext: string
  iv: string
  contentType: string
  createdAt: Date
  sender?: User
}

export interface DeleteEvent {
  id: string
  messageId: string
  chatId: string
  senderId: string
  signature: string
  timestamp: Date
  createdAt: Date
  delivered: boolean
  sender?: User
}

export interface SignalEvent {
  id: string
  chatId: string
  fromUserId: string
  toUserId: string | null
  type: string
  payload: string
  createdAt: Date
  consumed: boolean
  expiresAt: Date
}

// In-memory storage
const storage = {
  users: new Map<string, User>(),
  sessions: new Map<string, Session>(),
  magicLinks: new Map<string, MagicLink>(),
  chats: new Map<string, Chat>(),
  chatMembers: new Map<string, ChatMember>(),
  messages: new Map<string, Message>(),
  deleteEvents: new Map<string, DeleteEvent>(),
  signalEvents: new Map<string, SignalEvent>(),
}

const DEMO_PASSWORD_HASH = "b149338f9fce5559c4f3a99a8f5a719dd0561bca3e2d79f7bdd3ace0bfb84c68"

// Initialize with demo data
function initDemoData() {
  if (storage.users.size > 0) return

  // Create demo users with password "demo123" (pre-hashed)
  const demoUser: User = {
    id: "demo-user-1",
    email: "demo@example.com",
    passwordHash: DEMO_PASSWORD_HASH,
    name: "Demo User",
    avatar: null,
    publicKey: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const otherUser: User = {
    id: "other-user-1",
    email: "alice@example.com",
    passwordHash: DEMO_PASSWORD_HASH,
    name: "Alice",
    avatar: null,
    publicKey: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const thirdUser: User = {
    id: "other-user-2",
    email: "bob@example.com",
    passwordHash: DEMO_PASSWORD_HASH,
    name: "Bob",
    avatar: null,
    publicKey: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  storage.users.set(demoUser.id, demoUser)
  storage.users.set(otherUser.id, otherUser)
  storage.users.set(thirdUser.id, thirdUser)

  // Create demo chats
  const chat1: Chat = {
    id: "chat-1",
    name: null,
    isGroup: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const chat2: Chat = {
    id: "chat-2",
    name: "Team Chat",
    isGroup: true,
    createdAt: new Date(),
    updatedAt: new Date(Date.now() - 3600000),
  }

  storage.chats.set(chat1.id, chat1)
  storage.chats.set(chat2.id, chat2)

  // Create chat members
  const members = [
    { id: "member-1", chatId: "chat-1", userId: "demo-user-1", role: "member", joinedAt: new Date() },
    { id: "member-2", chatId: "chat-1", userId: "other-user-1", role: "member", joinedAt: new Date() },
    { id: "member-3", chatId: "chat-2", userId: "demo-user-1", role: "admin", joinedAt: new Date() },
    { id: "member-4", chatId: "chat-2", userId: "other-user-1", role: "member", joinedAt: new Date() },
    { id: "member-5", chatId: "chat-2", userId: "other-user-2", role: "member", joinedAt: new Date() },
  ]

  members.forEach((m) => storage.chatMembers.set(m.id, m))
}

// Initialize demo data
initDemoData()

// Helper to generate IDs
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Mock Prisma-like interface
export const db = {
  user: {
    findUnique: async ({ where }: { where: { id?: string; email?: string } }): Promise<User | null> => {
      if (where.id) return storage.users.get(where.id) || null
      if (where.email) {
        return Array.from(storage.users.values()).find((u) => u.email === where.email) || null
      }
      return null
    },
    create: async ({ data }: { data: Partial<User> }): Promise<User> => {
      const user: User = {
        id: generateId(),
        email: data.email!,
        passwordHash: data.passwordHash || null,
        name: data.name || null,
        avatar: data.avatar || null,
        publicKey: data.publicKey || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      storage.users.set(user.id, user)
      return user
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<User> }): Promise<User | null> => {
      const user = storage.users.get(where.id)
      if (!user) return null
      const updated = { ...user, ...data, updatedAt: new Date() }
      storage.users.set(where.id, updated)
      return updated
    },
  },

  session: {
    findUnique: async ({
      where,
      include,
    }: {
      where: { id?: string; token?: string }
      include?: { user?: boolean }
    }): Promise<Session | null> => {
      let session: Session | undefined
      if (where.id) session = storage.sessions.get(where.id)
      if (where.token) {
        session = Array.from(storage.sessions.values()).find((s) => s.token === where.token)
      }
      if (!session) return null
      if (include?.user) {
        session = { ...session, user: storage.users.get(session.userId) }
      }
      return session
    },
    create: async ({ data }: { data: Omit<Session, "id" | "createdAt"> }): Promise<Session> => {
      const session: Session = {
        id: generateId(),
        ...data,
        createdAt: new Date(),
      }
      storage.sessions.set(session.id, session)
      return session
    },
    delete: async ({ where }: { where: { id: string } }): Promise<void> => {
      storage.sessions.delete(where.id)
    },
    deleteMany: async ({ where }: { where: { userId: string } }): Promise<void> => {
      Array.from(storage.sessions.entries()).forEach(([id, session]) => {
        if (session.userId === where.userId) storage.sessions.delete(id)
      })
    },
  },

  magicLink: {
    findUnique: async ({
      where,
      include,
    }: {
      where: { token: string }
      include?: { user?: boolean }
    }): Promise<MagicLink | null> => {
      const link = Array.from(storage.magicLinks.values()).find((l) => l.token === where.token)
      if (!link) return null
      if (include?.user) {
        return { ...link, user: storage.users.get(link.userId) }
      }
      return link
    },
    create: async ({ data }: { data: Omit<MagicLink, "id" | "createdAt"> }): Promise<MagicLink> => {
      const link: MagicLink = {
        id: generateId(),
        ...data,
        createdAt: new Date(),
      }
      storage.magicLinks.set(link.id, link)
      return link
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<MagicLink> }): Promise<MagicLink | null> => {
      const link = storage.magicLinks.get(where.id)
      if (!link) return null
      const updated = { ...link, ...data }
      storage.magicLinks.set(where.id, updated)
      return updated
    },
  },

  chat: {
    findMany: async (options?: {
      where?: { members?: { some?: { userId: string } } }
      orderBy?: { updatedAt: string }
      include?: { members?: { include?: { user?: { select?: Record<string, boolean> } } }; messages?: object }
    }): Promise<Chat[]> => {
      let chats = Array.from(storage.chats.values())

      if (options?.where?.members?.some?.userId) {
        const userId = options.where.members.some.userId
        const userChatIds = Array.from(storage.chatMembers.values())
          .filter((m) => m.userId === userId)
          .map((m) => m.chatId)
        chats = chats.filter((c) => userChatIds.includes(c.id))
      }

      if (options?.orderBy?.updatedAt === "desc") {
        chats.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      }

      if (options?.include?.members || options?.include?.messages) {
        chats = chats.map((chat) => {
          const members = Array.from(storage.chatMembers.values())
            .filter((m) => m.chatId === chat.id)
            .map((m) => ({
              ...m,
              user: options?.include?.members?.include?.user ? storage.users.get(m.userId) : undefined,
            }))
          const messages = options?.include?.messages
            ? Array.from(storage.messages.values())
                .filter((m) => m.chatId === chat.id)
                .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                .slice(0, 1)
            : []
          return { ...chat, members, messages }
        })
      }

      return chats
    },
    findFirst: async (options?: {
      where?: {
        isGroup?: boolean
        members?: { every?: { userId: { in: string[] } }; some?: { userId: string } }
        AND?: object[]
      }
      include?: { members?: { include?: { user?: { select?: Record<string, boolean> } } } }
    }): Promise<Chat | null> => {
      const chats = await db.chat.findMany({ include: options?.include })

      for (const chat of chats) {
        if (options?.where?.isGroup !== undefined && chat.isGroup !== options.where.isGroup) continue

        if (options?.where?.members?.every?.userId?.in) {
          const memberUserIds = chat.members?.map((m) => m.userId) || []
          const allIn = memberUserIds.every((id) => options.where?.members?.every?.userId?.in?.includes(id))
          if (!allIn) continue
        }

        return chat
      }
      return null
    },
    findUnique: async ({
      where,
      include,
    }: {
      where: { id: string }
      include?: { members?: { include?: { user?: { select?: Record<string, boolean> } } } }
    }): Promise<Chat | null> => {
      const chat = storage.chats.get(where.id)
      if (!chat) return null

      if (include?.members) {
        const members = Array.from(storage.chatMembers.values())
          .filter((m) => m.chatId === chat.id)
          .map((m) => ({
            ...m,
            user: include.members?.include?.user ? storage.users.get(m.userId) : undefined,
          }))
        return { ...chat, members }
      }

      return chat
    },
    create: async ({
      data,
      include,
    }: {
      data: { name?: string | null; isGroup: boolean; members?: { create: { userId: string; role: string }[] } }
      include?: { members?: { include?: { user?: { select?: Record<string, boolean> } } } }
    }): Promise<Chat> => {
      const chat: Chat = {
        id: generateId(),
        name: data.name || null,
        isGroup: data.isGroup,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      storage.chats.set(chat.id, chat)

      if (data.members?.create) {
        data.members.create.forEach((m) => {
          const member: ChatMember = {
            id: generateId(),
            chatId: chat.id,
            userId: m.userId,
            role: m.role,
            joinedAt: new Date(),
          }
          storage.chatMembers.set(member.id, member)
        })
      }

      if (include?.members) {
        const members = Array.from(storage.chatMembers.values())
          .filter((m) => m.chatId === chat.id)
          .map((m) => ({
            ...m,
            user: include.members?.include?.user ? storage.users.get(m.userId) : undefined,
          }))
        return { ...chat, members }
      }

      return chat
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<Chat> }): Promise<Chat | null> => {
      const chat = storage.chats.get(where.id)
      if (!chat) return null
      const updated = { ...chat, ...data, updatedAt: new Date() }
      storage.chats.set(where.id, updated)
      return updated
    },
  },

  chatMember: {
    findUnique: async ({
      where,
    }: { where: { chatId_userId: { chatId: string; userId: string } } }): Promise<ChatMember | null> => {
      return (
        Array.from(storage.chatMembers.values()).find(
          (m) => m.chatId === where.chatId_userId.chatId && m.userId === where.chatId_userId.userId,
        ) || null
      )
    },
    findFirst: async ({ where }: { where: { chatId: string; userId: string } }): Promise<ChatMember | null> => {
      return (
        Array.from(storage.chatMembers.values()).find((m) => m.chatId === where.chatId && m.userId === where.userId) ||
        null
      )
    },
  },

  message: {
    findMany: async ({
      where,
      orderBy,
      take,
      cursor,
      skip,
      select,
    }: {
      where: { chatId: string }
      orderBy?: { createdAt: string }
      take?: number
      cursor?: { id: string }
      skip?: number
      select?: Record<string, boolean | object>
    }): Promise<Message[]> => {
      let messages = Array.from(storage.messages.values()).filter((m) => m.chatId === where.chatId)

      if (orderBy?.createdAt === "desc") {
        messages.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      } else if (orderBy?.createdAt === "asc") {
        messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      }

      if (cursor?.id) {
        const cursorIndex = messages.findIndex((m) => m.id === cursor.id)
        if (cursorIndex !== -1) {
          messages = messages.slice(cursorIndex + (skip || 0))
        }
      }

      if (take) messages = messages.slice(0, take)

      // Add sender info if needed
      if (select?.sender) {
        messages = messages.map((m) => ({
          ...m,
          sender: storage.users.get(m.senderId),
        }))
      }

      return messages
    },
    findUnique: async ({ where }: { where: { id: string } }): Promise<Message | null> => {
      return storage.messages.get(where.id) || null
    },
    create: async ({
      data,
      select,
    }: {
      data: Omit<Message, "id" | "createdAt">
      select?: Record<string, boolean | object>
    }): Promise<Message> => {
      const message: Message = {
        id: generateId(),
        ...data,
        createdAt: new Date(),
      }
      storage.messages.set(message.id, message)

      // Update chat timestamp
      const chat = storage.chats.get(data.chatId)
      if (chat) {
        storage.chats.set(chat.id, { ...chat, updatedAt: new Date() })
      }

      if (select?.sender) {
        return { ...message, sender: storage.users.get(message.senderId) }
      }
      return message
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<Message> }): Promise<Message | null> => {
      const message = storage.messages.get(where.id)
      if (!message) return null
      const updated = { ...message, ...data }
      storage.messages.set(where.id, updated)
      return updated
    },
    delete: async ({ where }: { where: { id: string } }): Promise<void> => {
      storage.messages.delete(where.id)
    },
  },

  deleteEvent: {
    findMany: async ({
      where,
      orderBy,
      include,
    }: {
      where: { chatId: string; delivered?: boolean; timestamp?: { gt: Date } }
      orderBy?: { timestamp: string }
      include?: { sender?: { select?: Record<string, boolean> } }
    }): Promise<DeleteEvent[]> => {
      let events = Array.from(storage.deleteEvents.values()).filter((e) => {
        if (e.chatId !== where.chatId) return false
        if (where.delivered !== undefined && e.delivered !== where.delivered) return false
        if (where.timestamp?.gt && e.timestamp <= where.timestamp.gt) return false
        return true
      })

      if (orderBy?.timestamp === "asc") {
        events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      }

      if (include?.sender) {
        events = events.map((e) => ({
          ...e,
          sender: storage.users.get(e.senderId),
        }))
      }

      return events
    },
    create: async ({ data }: { data: Omit<DeleteEvent, "id" | "createdAt"> }): Promise<DeleteEvent> => {
      const event: DeleteEvent = {
        id: generateId(),
        ...data,
        createdAt: new Date(),
      }
      storage.deleteEvents.set(event.id, event)
      return event
    },
    updateMany: async ({
      where,
      data,
    }: { where: { id: { in: string[] } }; data: Partial<DeleteEvent> }): Promise<void> => {
      where.id.in.forEach((id) => {
        const event = storage.deleteEvents.get(id)
        if (event) storage.deleteEvents.set(id, { ...event, ...data })
      })
    },
  },

  signalEvent: {
    findMany: async ({
      where,
      orderBy,
    }: {
      where: { chatId: string; toUserId: string; consumed?: boolean; expiresAt?: { gt: Date } }
      orderBy?: { createdAt: string }
    }): Promise<SignalEvent[]> => {
      const events = Array.from(storage.signalEvents.values()).filter((e) => {
        if (e.chatId !== where.chatId) return false
        if (e.toUserId !== where.toUserId) return false
        if (where.consumed !== undefined && e.consumed !== where.consumed) return false
        if (where.expiresAt?.gt && e.expiresAt <= where.expiresAt.gt) return false
        return true
      })

      if (orderBy?.createdAt === "asc") {
        events.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      }

      return events
    },
    create: async ({ data }: { data: Omit<SignalEvent, "id" | "createdAt"> }): Promise<SignalEvent> => {
      const event: SignalEvent = {
        id: generateId(),
        ...data,
        createdAt: new Date(),
      }
      storage.signalEvents.set(event.id, event)
      return event
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: { id: { in: string[] } }
      data: Partial<SignalEvent>
    }): Promise<void> => {
      where.id.in.forEach((id) => {
        const event = storage.signalEvents.get(id)
        if (event) storage.signalEvents.set(id, { ...event, ...data })
      })
    },
    deleteMany: async ({ where }: { where: { expiresAt: { lt: Date } } }): Promise<void> => {
      Array.from(storage.signalEvents.entries()).forEach(([id, event]) => {
        if (event.expiresAt < where.expiresAt.lt) storage.signalEvents.delete(id)
      })
    },
  },
}

// Export as prisma for backward compatibility
export const prisma = db
