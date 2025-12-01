import { type NextRequest, NextResponse } from "next/server"
import { getSession, verifyJWT } from "@/lib/auth"
import { db } from "@/lib/db"

// Signal TTL: 30 seconds (short-lived for security)
const SIGNAL_TTL_MS = 30 * 1000

export async function GET(request: NextRequest) {
  try {
    // Authenticate via header or session
    const authHeader = request.headers.get("authorization")
    let userId: string | null = null

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7)
      const payload = await verifyJWT(token)
      userId = payload?.userId || null
    }

    if (!userId) {
      const session = await getSession()
      userId = session?.user?.id || null
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const chatId = request.nextUrl.searchParams.get("chatId")

    if (!chatId) {
      return NextResponse.json({ error: "Chat ID required" }, { status: 400 })
    }

    // Verify user belongs to chat
    const membership = await db.chatMember.findUnique({
      where: {
        chatId_userId: {
          chatId,
          userId,
        },
      },
    })

    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Fetch unconsumed signals for this user
    const signals = await db.signalEvent.findMany({
      where: {
        chatId,
        toUserId: userId,
        consumed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "asc" },
    })

    // Mark signals as consumed
    if (signals.length > 0) {
      await db.signalEvent.updateMany({
        where: {
          id: { in: signals.map((s) => s.id) },
        },
        data: { consumed: true },
      })
    }

    return NextResponse.json({
      signals: signals.map((s) => ({
        type: s.type,
        payload: s.payload,
        fromUserId: s.fromUserId,
        toUserId: s.toUserId,
        chatId: s.chatId,
      })),
    })
  } catch (error) {
    console.error("Signal fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch signals" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate via header or session
    const authHeader = request.headers.get("authorization")
    let userId: string | null = null

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7)
      const payload = await verifyJWT(token)
      userId = payload?.userId || null
    }

    if (!userId) {
      const session = await getSession()
      userId = session?.user?.id || null
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { type, payload, toUserId, chatId } = await request.json()

    if (!type || !payload || !chatId) {
      return NextResponse.json({ error: "Type, payload, and chatId are required" }, { status: 400 })
    }

    // Validate signal type
    const validTypes = ["offer", "answer", "ice-candidate"]
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: "Invalid signal type" }, { status: 400 })
    }

    // Verify from user belongs to chat
    const fromMembership = await db.chatMember.findUnique({
      where: {
        chatId_userId: {
          chatId,
          userId,
        },
      },
    })

    if (!fromMembership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    if (toUserId) {
      const toMembership = await db.chatMember.findUnique({
        where: {
          chatId_userId: {
            chatId,
            userId: toUserId,
          },
        },
      })

      if (!toMembership) {
        return NextResponse.json({ error: "Target user not in chat" }, { status: 400 })
      }
    }

    // Create signal event
    const signal = await db.signalEvent.create({
      data: {
        chatId,
        fromUserId: userId,
        toUserId: toUserId || null,
        type,
        payload,
        expiresAt: new Date(Date.now() + SIGNAL_TTL_MS),
        consumed: false,
      },
    })

    // Cleanup expired signals
    await db.signalEvent.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    })

    return NextResponse.json({ success: true, signalId: signal.id })
  } catch (error) {
    console.error("Signal send error:", error)
    return NextResponse.json({ error: "Failed to send signal" }, { status: 500 })
  }
}
