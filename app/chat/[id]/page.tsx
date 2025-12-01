import { redirect, notFound } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { ChatRoom } from "@/components/chat-room"

interface ChatPageProps {
  params: Promise<{ id: string }>
}

export default async function ChatPage({ params }: ChatPageProps) {
  const { id } = await params
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  const chat = await db.chat.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              publicKey: true,
            },
          },
        },
      },
    },
  })

  if (!chat) {
    notFound()
  }

  // Verify user is a member
  const isMember = chat.members?.some((m: any) => m.user?.id === user.id)
  if (!isMember) {
    redirect("/chats")
  }

  const otherMembers = chat.members?.filter((m: any) => m.user?.id !== user.id).map((m: any) => m.user) || []

  return (
    <ChatRoom
      chatId={chat.id}
      chatName={chat.name || otherMembers[0]?.name || otherMembers[0]?.email || "Chat"}
      isGroup={chat.isGroup}
      currentUser={user}
      members={chat.members?.map((m: any) => m.user) || []}
    />
  )
}
