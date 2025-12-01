import { type NextRequest, NextResponse } from "next/server"
import { verifyMagicLink, createSession, createJWT } from "@/lib/auth"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token")

    if (!token) {
      return NextResponse.redirect(new URL("/login?error=invalid", request.url))
    }

    const user = await verifyMagicLink(token)

    if (!user) {
      return NextResponse.redirect(new URL("/login?error=expired", request.url))
    }

    // Create session
    const session = await createSession(user.id, request.headers.get("user-agent") || undefined)

    // Create JWT
    const jwt = await createJWT({
      userId: user.id,
      sessionId: session.id,
      email: user.email,
    })

    // Set cookie
    const cookieStore = await cookies()
    cookieStore.set("auth_token", jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    })

    return NextResponse.redirect(new URL("/chats", request.url))
  } catch (error) {
    console.error("Verify error:", error)
    return NextResponse.redirect(new URL("/login?error=failed", request.url))
  }
}
