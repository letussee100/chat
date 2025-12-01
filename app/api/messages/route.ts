import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const chatId = request.nextUrl.searchParams.get("chatId")
    const cursor = request.nextUrl.searchParams.get("cursor")
    const limit = Number.parseInt(request.nextUrl.searchParams.get("limit") || "50")

    if (!chatId) {
      return NextResponse.json({ error: "Chat ID required" }, { status: 400 })
    }

    // Verify user is member of chat
    const membership = await db.chatMember.findUnique({
      where: {
        chatId_userId: {
          chatId,
          userId: session.user!.id,
        },
      },
    })

    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Fetch messages (ciphertext only)
    const messages = await db.message.findMany({
      where: { chatId },
      orderBy: { createdAt: "desc" },
      take: limit,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      select: {
        id: true,
        senderId: true,
        ciphertext: true,
        iv: true,
        contentType: true,
        createdAt: true,
        sender: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    })

    // Also fetch any undelivered delete events
    const deleteEvents = await db.deleteEvent.findMany({
      where: {
        chatId,
        delivered: false,
      },
    })

    // Mark delete events as delivered
    if (deleteEvents.length > 0) {
      await db.deleteEvent.updateMany({
        where: {
          id: { in: deleteEvents.map((e) => e.id) },
        },
        data: { delivered: true },
      })
    }

    return NextResponse.json({
      messages: messages.reverse(),
      deleteEvents,
      nextCursor: messages.length === limit ? messages[messages.length - 1]?.id : null,
    })
  } catch (error) {
    console.error("Messages error:", error)
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { chatId, ciphertext, iv, contentType = "text" } = await request.json()

    if (!chatId || !ciphertext || !iv) {
      return NextResponse.json({ error: "Chat ID, ciphertext, and IV are required" }, { status: 400 })
    }

    // Verify user is member of chat
    const membership = await db.chatMember.findUnique({
      where: {
        chatId_userId: {
          chatId,
          userId: session.user!.id,
        },
      },
    })

    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Store message (ciphertext only - server never sees plaintext)
    const message = await db.message.create({
      data: {
        chatId,
        senderId: session.user!.id,
        ciphertext,
        iv,
        contentType,
      },
      select: {
        id: true,
        senderId: true,
        ciphertext: true,
        iv: true,
        contentType: true,
        createdAt: true,
        sender: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    })

    // Update chat timestamp
    await db.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    })

    return NextResponse.json({ message })
  } catch (error) {
    console.error("Send message error:", error)
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 })
  }
}
