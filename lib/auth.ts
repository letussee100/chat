import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import { db } from "./db"

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "your-secret-key-min-32-characters!!")

export interface TokenPayload {
  userId: string
  sessionId: string
  email: string
}

function generateSecureToken(length = 32): string {
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export async function createSession(userId: string, deviceInfo?: string) {
  const token = generateSecureToken(32)
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

  const session = await db.session.create({
    data: {
      userId,
      token,
      deviceInfo: deviceInfo || null,
      expiresAt,
    },
  })

  return session
}

export async function createJWT(payload: TokenPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(JWT_SECRET)
}

export async function verifyJWT(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as TokenPayload
  } catch {
    return null
  }
}

export async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get("auth_token")?.value

  if (!token) return null

  const payload = await verifyJWT(token)
  if (!payload) return null

  const session = await db.session.findUnique({
    where: { id: payload.sessionId },
    include: { user: true },
  })

  if (!session || session.expiresAt < new Date()) {
    return null
  }

  return session
}

export async function getCurrentUser() {
  const session = await getSession()
  return session?.user || null
}

export async function generateMagicLink(email: string) {
  // Find or create user
  let user = await db.user.findUnique({ where: { email } })

  if (!user) {
    user = await db.user.create({
      data: { email },
    })
  }

  const token = generateSecureToken(32)
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

  await db.magicLink.create({
    data: {
      userId: user.id,
      token,
      expiresAt,
      used: false,
    },
  })

  return { token, user }
}

export async function verifyMagicLink(token: string) {
  const magicLink = await db.magicLink.findUnique({
    where: { token },
    include: { user: true },
  })

  if (!magicLink || magicLink.used || magicLink.expiresAt < new Date()) {
    return null
  }

  // Mark as used
  await db.magicLink.update({
    where: { id: magicLink.id },
    data: { used: true },
  })

  return magicLink.user
}

export async function invalidateSession(sessionId: string) {
  try {
    await db.session.delete({ where: { id: sessionId } })
  } catch {
    // Session may already be deleted
  }
}
