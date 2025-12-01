import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { ChatList } from "@/components/chat-list"
import { AppHeader } from "@/components/app-header"

export default async function ChatsPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  const chats = await db.chat.findMany({
    where: {
      members: {
        some: { userId: user.id },
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

  const formattedChats = (chats as any[]).map((chat) => ({
    id: chat.id,
    name: chat.name,
    isGroup: chat.isGroup,
    updatedAt: chat.updatedAt.toISOString(),
    members: chat.members.map((m: any) => m.user),
    lastMessage: chat.messages?.[0]
      ? {
          id: chat.messages[0].id,
          createdAt: chat.messages[0].createdAt.toISOString(),
          contentType: chat.messages[0].contentType,
        }
      : null,
  }))

  return (
    <div className="min-h-screen bg-background">
      <AppHeader user={user} />
      <main className="container max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Messages</h1>
        </div>
        <ChatList initialChats={formattedChats} currentUserId={user.id} />
      </main>
    </div>
  )
}
