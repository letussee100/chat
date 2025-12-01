import { type NextRequest, NextResponse } from "next/server"
import { getSession, invalidateSession, verifyJWT } from "@/lib/auth"
import { db } from "@/lib/db"
import { cookies } from "next/headers"

export async function GET() {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    return NextResponse.json({
      user: {
        id: session.user!.id,
        email: session.user!.email,
        name: session.user!.name,
        avatar: session.user!.avatar,
        publicKey: session.user!.publicKey,
      },
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
      },
    })
  } catch (error) {
    console.error("Session error:", error)
    return NextResponse.json({ error: "Session error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { name, avatar, publicKey } = await request.json()

    const updatedUser = await db.user.update({
      where: { id: session.user!.id },
      data: {
        ...(name !== undefined && { name }),
        ...(avatar !== undefined && { avatar }),
        ...(publicKey !== undefined && { publicKey }),
      },
    })

    return NextResponse.json({
      user: {
        id: updatedUser!.id,
        email: updatedUser!.email,
        name: updatedUser!.name,
        avatar: updatedUser!.avatar,
        publicKey: updatedUser!.publicKey,
      },
    })
  } catch (error) {
    console.error("Update session error:", error)
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("auth_token")?.value

    if (token) {
      const payload = await verifyJWT(token)
      if (payload) {
        await invalidateSession(payload.sessionId)
      }
    }

    cookieStore.delete("auth_token")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Logout error:", error)
    return NextResponse.json({ error: "Logout failed" }, { status: 500 })
  }
}
