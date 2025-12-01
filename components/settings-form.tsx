"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Check } from "lucide-react"

interface User {
  id: string
  email: string
  name: string | null
  avatar: string | null
}

interface SettingsFormProps {
  user: User
}

export function SettingsForm({ user }: SettingsFormProps) {
  const router = useRouter()
  const [name, setName] = useState(user.name || "")
  const [isLoading, setIsLoading] = useState(false)
  const [isSaved, setIsSaved] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/session", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })

      if (!response.ok) {
        throw new Error("Failed to update profile")
      }

      setIsSaved(true)
      setTimeout(() => setIsSaved(false), 2000)
      router.refresh()
    } catch (error) {
      console.error("Update error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={user.email} disabled className="mt-1.5 bg-muted" />
      </div>

      <div>
        <Label htmlFor="name">Display name</Label>
        <Input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="mt-1.5"
        />
      </div>

      <Button type="submit" disabled={isLoading}>
        {isLoading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : isSaved ? (
          <Check className="w-4 h-4 mr-2" />
        ) : null}
        {isSaved ? "Saved!" : "Save changes"}
      </Button>
    </form>
  )
}
