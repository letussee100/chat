import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"

// Delete control message schema
export interface DeleteControlMessage {
  messageId: string
  chatId: string
  senderId: string
  signature: string // Cryptographic signature
  timestamp: number
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { messageId, chatId, signature, timestamp } = await request.json()

    if (!messageId || !chatId || !signature) {
      return NextResponse.json({ error: "Message ID, chat ID, and signature are required" }, { status: 400 })
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

    // Verify the message exists and belongs to this user
    const message = await db.message.findUnique({
      where: { id: messageId },
    })

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 })
    }

    if (message.senderId !== session.user!.id) {
      return NextResponse.json({ error: "Can only delete your own messages" }, { status: 403 })
    }

    // Create delete event for other participants to verify and process
    // Server stores the signed delete request - clients verify signature
    const deleteEvent = await db.deleteEvent.create({
      data: {
        messageId,
        chatId,
        senderId: session.user!.id,
        signature,
        timestamp: new Date(timestamp || Date.now()),
        delivered: false,
      },
    })

    // Mark message as deleted (we keep metadata, remove ciphertext)
    await db.message.update({
      where: { id: messageId },
      data: {
        ciphertext: "", // Clear the encrypted content
        iv: "",
        contentType: "deleted",
      },
    })

    return NextResponse.json({
      success: true,
      deleteEvent: {
        id: deleteEvent.id,
        messageId: deleteEvent.messageId,
        chatId: deleteEvent.chatId,
        senderId: deleteEvent.senderId,
        signature: deleteEvent.signature,
        timestamp: deleteEvent.timestamp,
      },
    })
  } catch (error) {
    console.error("Delete message error:", error)
    return NextResponse.json({ error: "Failed to delete message" }, { status: 500 })
  }
}

// Get pending delete events for sync
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const chatId = request.nextUrl.searchParams.get("chatId")
    const since = request.nextUrl.searchParams.get("since")

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

    // Fetch delete events
    const deleteEvents = await db.deleteEvent.findMany({
      where: {
        chatId,
        ...(since && {
          timestamp: { gt: new Date(since) },
        }),
      },
      orderBy: { timestamp: "asc" },
      include: {
        sender: {
          select: {
            id: true,
            publicKey: true,
          },
        },
      },
    })

    return NextResponse.json({
      deleteEvents: deleteEvents.map((event) => ({
        id: event.id,
        messageId: event.messageId,
        chatId: event.chatId,
        senderId: event.senderId,
        signature: event.signature,
        timestamp: event.timestamp,
        senderPublicKey: event.sender?.publicKey,
      })),
    })
  } catch (error) {
    console.error("Fetch delete events error:", error)
    return NextResponse.json({ error: "Failed to fetch delete events" }, { status: 500 })
  }
}
