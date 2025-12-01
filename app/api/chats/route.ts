import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const chats = await db.chat.findMany({
      where: {
        members: {
          some: { userId: session.user!.id },
        },
      },
      orderBy: { updatedAt: "desc" },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            createdAt: true,
            contentType: true,
          },
        },
      },
    })

    return NextResponse.json({
      chats: (chats as any[]).map((chat) => ({
        id: chat.id,
        name: chat.name,
        isGroup: chat.isGroup,
        updatedAt: chat.updatedAt,
        members: chat.members?.map((m: any) => m.user) || [],
        lastMessage: chat.messages?.[0] || null,
      })),
    })
  } catch (error) {
    console.error("Chats error:", error)
    return NextResponse.json({ error: "Failed to fetch chats" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { name, memberIds, isGroup = false } = await request.json()

    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return NextResponse.json({ error: "At least one member is required" }, { status: 400 })
    }

    // Ensure current user is included
    const allMemberIds = [...new Set([session.user!.id, ...memberIds])]

    // For 1:1 chats, check if one already exists
    if (!isGroup && allMemberIds.length === 2) {
      const existingChat = await db.chat.findFirst({
        where: {
          isGroup: false,
          members: {
            every: {
              userId: { in: allMemberIds },
            },
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatar: true,
                },
              },
            },
          },
        },
      })

      if (existingChat && existingChat.members && existingChat.members.length === 2) {
        return NextResponse.json({
          chat: {
            id: existingChat.id,
            name: existingChat.name,
            isGroup: existingChat.isGroup,
            members: existingChat.members.map((m: any) => m.user),
          },
        })
      }
    }

    // Create new chat
    const chat = await db.chat.create({
      data: {
        name: isGroup ? name : null,
        isGroup,
        members: {
          create: allMemberIds.map((userId, index) => ({
            userId,
            role: index === 0 ? "admin" : "member",
          })),
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json({
      chat: {
        id: chat.id,
        name: chat.name,
        isGroup: chat.isGroup,
        members: chat.members?.map((m: any) => m.user) || [],
      },
    })
  } catch (error) {
    console.error("Create chat error:", error)
    return NextResponse.json({ error: "Failed to create chat" }, { status: 500 })
  }
}
