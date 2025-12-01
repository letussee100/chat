"use client"

import type React from "react"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { useCrypto, verifySignature, importPublicKey } from "@/hooks/use-crypto"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowLeft, Send, Lock, Phone, Video, MoreVertical, Trash2, ShieldCheck } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { VideoCall } from "./video-call"
import useSWR from "swr"

interface User {
  id: string
  email: string
  name: string | null
  avatar: string | null
  publicKey?: string | null
}

interface Message {
  id: string
  senderId: string
  ciphertext: string
  iv: string
  contentType: string
  createdAt: string
  sender: {
    id: string
    name: string | null
    avatar: string | null
  }
  decryptedContent?: string
  isDeleted?: boolean
}

interface ChatRoomProps {
  chatId: string
  chatName: string
  isGroup: boolean
  currentUser: User
  members: User[]
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function ChatRoom({ chatId, chatName, isGroup, currentUser, members }: ChatRoomProps) {
  const { isReady, encryptMessage, decryptMessage, signData } = useCrypto()

  const [inputValue, setInputValue] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [showVideoCall, setShowVideoCall] = useState(false)
  const [decryptedMessages, setDecryptedMessages] = useState<Map<string, string>>(new Map())
  const [deletedMessageIds, setDeletedMessageIds] = useState<Set<string>>(new Set())
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { data, mutate } = useSWR<{
    messages: Message[]
    deleteEvents: Array<{
      messageId: string
      senderId: string
      signature: string
      senderPublicKey: string
    }>
  }>(`/api/messages?chatId=${chatId}`, fetcher, {
    refreshInterval: 2000,
  })

  const messages = data?.messages || []

  // Decrypt messages when they arrive
  useEffect(() => {
    if (!decryptMessage || !messages.length) return

    const decryptAll = async () => {
      const newDecrypted = new Map(decryptedMessages)

      for (const msg of messages) {
        if (!newDecrypted.has(msg.id) && msg.ciphertext && msg.iv && msg.contentType !== "deleted") {
          try {
            const plaintext = await decryptMessage(msg.ciphertext, msg.iv)
            newDecrypted.set(msg.id, plaintext)
          } catch (error) {
            console.error("Failed to decrypt message:", msg.id, error)
            newDecrypted.set(msg.id, "[Unable to decrypt]")
          }
        }
      }

      setDecryptedMessages(newDecrypted)
    }

    decryptAll()
  }, [messages, decryptMessage, decryptedMessages])

  // Process delete events
  useEffect(() => {
    if (!data?.deleteEvents?.length) return

    const processDeletes = async () => {
      const newDeleted = new Set(deletedMessageIds)

      for (const event of data.deleteEvents) {
        if (newDeleted.has(event.messageId)) continue

        if (event.senderPublicKey) {
          try {
            const pubKey = await importPublicKey(event.senderPublicKey)
            const dataToVerify = JSON.stringify({
              messageId: event.messageId,
              senderId: event.senderId,
            })
            const isValid = await verifySignature(dataToVerify, event.signature, pubKey)

            if (isValid) {
              newDeleted.add(event.messageId)
            }
          } catch (error) {
            console.error("Failed to verify delete signature:", error)
          }
        } else {
          newDeleted.add(event.messageId)
        }
      }

      setDeletedMessageIds(newDeleted)
    }

    processDeletes()
  }, [data?.deleteEvents, deletedMessageIds])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || !encryptMessage || isSending) return

    setIsSending(true)

    try {
      const { ciphertext, iv } = await encryptMessage(inputValue.trim())

      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId,
          ciphertext,
          iv,
          contentType: "text",
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to send message")
      }

      setInputValue("")
      mutate()
    } catch (error) {
      console.error("Send error:", error)
    } finally {
      setIsSending(false)
    }
  }

  const handleDelete = useCallback(
    async (messageId: string) => {
      if (!signData) return

      try {
        const dataToSign = JSON.stringify({
          messageId,
          senderId: currentUser.id,
        })
        const signature = await signData(dataToSign)

        const response = await fetch("/api/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageId,
            chatId,
            signature,
            timestamp: Date.now(),
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to delete message")
        }

        setDeletedMessageIds((prev) => new Set(prev).add(messageId))
        mutate()
      } catch (error) {
        console.error("Delete error:", error)
      }
    },
    [chatId, currentUser.id, signData, mutate],
  )

  const otherMember = members.find((m) => m.id !== currentUser.id)

  if (showVideoCall) {
    return (
      <VideoCall
        chatId={chatId}
        currentUserId={currentUser.id}
        targetUserId={otherMember?.id || ""}
        targetUserName={otherMember?.name || otherMember?.email || "User"}
        onClose={() => setShowVideoCall(false)}
      />
    )
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header with glass effect */}
      <header className="glass-header flex items-center gap-3 px-4 h-16">
        <Button variant="ghost" size="icon" asChild className="hover:bg-chat-hover">
          <Link href="/chats">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            <span className="sr-only">Back to chats</span>
          </Link>
        </Button>

        <Avatar className="h-10 w-10 ring-2 ring-border">
          <AvatarImage src={otherMember?.avatar || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary font-medium">
            {chatName[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate">{chatName}</p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="w-3 h-3 encrypt-indicator" />
            <span>End-to-end encrypted</span>
          </div>
        </div>

        {!isGroup && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setShowVideoCall(true)} className="hover:bg-chat-hover">
              <Video className="w-5 h-5 text-muted-foreground" />
              <span className="sr-only">Video call</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setShowVideoCall(true)} className="hover:bg-chat-hover">
              <Phone className="w-5 h-5 text-muted-foreground" />
              <span className="sr-only">Voice call</span>
            </Button>
          </div>
        )}
      </header>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!isReady && (
          <div className="flex items-center justify-center gap-2 p-4 bg-chat-warning/10 border border-chat-warning/20 rounded-xl text-chat-warning text-sm">
            <Lock className="w-4 h-4" />
            <span>Initializing encryption...</span>
          </div>
        )}

        {messages.map((message) => {
          const isOwn = message.senderId === currentUser.id
          const isDeleted = deletedMessageIds.has(message.id) || message.contentType === "deleted"
          const content = isDeleted ? "This message was deleted" : decryptedMessages.get(message.id) || "Decrypting..."

          return (
            <div key={message.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] group ${isOwn ? "order-2" : "order-1"}`}>
                <div
                  className={`px-4 py-2.5 rounded-2xl ${
                    isDeleted
                      ? "bg-muted text-muted-foreground italic"
                      : isOwn
                        ? "chat-bubble-sent rounded-br-md"
                        : "chat-bubble-received rounded-bl-md border border-border"
                  }`}
                >
                  <p className="text-[15px] leading-relaxed">{content}</p>
                </div>
                <div
                  className={`flex items-center gap-2 mt-1.5 text-xs text-muted-foreground ${
                    isOwn ? "justify-end" : "justify-start"
                  }`}
                >
                  <span>
                    {new Date(message.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {isOwn && !isDeleted && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-chat-hover"
                        >
                          <MoreVertical className="w-3 h-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-card border-border">
                        <DropdownMenuItem
                          onClick={() => handleDelete(message.id)}
                          className="text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete for everyone
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <form onSubmit={handleSend} className="flex items-center gap-3 p-4 bg-chat-header border-t border-border">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Type a message..."
          disabled={!isReady || isSending}
          className="flex-1 h-12 bg-card border-border focus:border-primary rounded-xl"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!inputValue.trim() || !isReady || isSending}
          className="h-12 w-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20"
        >
          <Send className="w-5 h-5" />
          <span className="sr-only">Send</span>
        </Button>
      </form>
    </div>
  )
}
