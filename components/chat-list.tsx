"use client"

import { useState } from "react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Search, Lock, Users, ShieldCheck } from "lucide-react"
import { NewChatDialog } from "./new-chat-dialog"

interface ChatMember {
  id: string
  name: string | null
  email: string
  avatar: string | null
}

interface Chat {
  id: string
  name: string | null
  isGroup: boolean
  updatedAt: string
  members: ChatMember[]
  lastMessage: {
    id: string
    createdAt: string
    contentType: string
  } | null
}

interface ChatListProps {
  initialChats: Chat[]
  currentUserId: string
}

export function ChatList({ initialChats, currentUserId }: ChatListProps) {
  const [chats] = useState(initialChats)
  const [searchQuery, setSearchQuery] = useState("")
  const [showNewChat, setShowNewChat] = useState(false)

  const filteredChats = chats.filter((chat) => {
    const otherMembers = chat.members.filter((m) => m.id !== currentUserId)
    const chatName = chat.name || otherMembers.map((m) => m.name || m.email).join(", ")
    return chatName.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const getChatDisplayInfo = (chat: Chat) => {
    const otherMembers = chat.members.filter((m) => m.id !== currentUserId)
    const name = chat.name || otherMembers.map((m) => m.name || m.email).join(", ")
    const avatar = chat.isGroup ? null : otherMembers[0]?.avatar
    const initials = chat.isGroup
      ? chat.name?.[0]?.toUpperCase() || "G"
      : (otherMembers[0]?.name?.[0] || otherMembers[0]?.email[0])?.toUpperCase()

    return { name, avatar, initials }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 bg-card border-border focus:border-primary"
          />
        </div>
        <Button
          onClick={() => setShowNewChat(true)}
          className="h-11 px-4 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/25 transition-all"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Chat
        </Button>
      </div>

      {filteredChats.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-10 h-10 text-primary" />
          </div>
          <h3 className="font-semibold text-lg text-foreground mb-1">No conversations yet</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Start a new encrypted conversation with your contacts
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredChats.map((chat) => {
            const { name, avatar, initials } = getChatDisplayInfo(chat)
            return (
              <Link
                key={chat.id}
                href={`/chat/${chat.id}`}
                className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border hover:border-primary/20 hover:shadow-md hover:shadow-primary/5 transition-all duration-200"
              >
                <Avatar className="h-12 w-12 ring-2 ring-border">
                  <AvatarImage src={avatar || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">
                    {chat.isGroup ? <Users className="w-5 h-5" /> : initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-foreground truncate">{name}</p>
                    {chat.lastMessage && (
                      <span className="text-xs text-muted-foreground ml-2 shrink-0">
                        {formatDistanceToNow(new Date(chat.lastMessage.createdAt), {
                          addSuffix: false,
                        })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Lock className="w-3 h-3 encrypt-indicator" />
                    <span className="truncate">End-to-end encrypted</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <NewChatDialog open={showNewChat} onOpenChange={setShowNewChat} />
    </div>
  )
}
