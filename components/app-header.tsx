"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ShieldCheck, Settings, LogOut, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface User {
  id: string
  email: string
  name: string | null
  avatar: string | null
}

interface AppHeaderProps {
  user: User
}

export function AppHeader({ user }: AppHeaderProps) {
  const router = useRouter()

  const handleLogout = async () => {
    await fetch("/api/auth/session", { method: "DELETE" })
    router.push("/login")
    router.refresh()
  }

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : user.email[0].toUpperCase()

  return (
    <header className="glass-header sticky top-0 z-50">
      <div className="container max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/chats" className="flex items-center gap-3 group">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-md shadow-primary/20 group-hover:shadow-lg group-hover:shadow-primary/30 transition-shadow">
            <ShieldCheck className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground">SecureChat</span>
        </Link>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" asChild className="hover:bg-chat-hover">
            <Link href="/chats">
              <MessageSquare className="w-5 h-5 text-muted-foreground" />
              <span className="sr-only">Chats</span>
            </Link>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full hover:bg-chat-hover">
                <Avatar className="h-9 w-9 ring-2 ring-border">
                  <AvatarImage src={user.avatar || undefined} alt={user.name || user.email} />
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-card border-border">
              <div className="px-3 py-2">
                <p className="text-sm font-medium text-foreground">{user.name || "User"}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem asChild className="hover:bg-chat-hover cursor-pointer">
                <Link href="/settings">
                  <Settings className="w-4 h-4 mr-2 text-muted-foreground" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive hover:bg-destructive/10 cursor-pointer"
              >
                <LogOut className="w-4 h-4 mr-2" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
