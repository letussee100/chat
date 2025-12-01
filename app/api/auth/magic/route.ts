import { type NextRequest, NextResponse } from "next/server"
import { generateMagicLink } from "@/lib/auth"
import { sendEmail, createMagicLinkEmail } from "@/lib/email"

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    const { token } = await generateMagicLink(email)

    // Build magic link URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get("origin") || ""
    const magicLinkUrl = `${baseUrl}/api/auth/verify?token=${token}`

    // Send email
    await sendEmail({
      to: email,
      subject: "Sign in to SecureChat",
      html: createMagicLinkEmail(magicLinkUrl),
    })

    return NextResponse.json({
      success: true,
      message: "Magic link sent to your email",
    })
  } catch (error) {
    console.error("Magic link error:", error)
    return NextResponse.json({ error: "Failed to send magic link" }, { status: 500 })
  }
}
