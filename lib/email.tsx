// Email service for magic link authentication
// Configure with your preferred provider (SendGrid, Resend, etc.)

interface SendEmailOptions {
  to: string
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  // If SMTP is not configured, log to console (development mode)
  if (!process.env.SMTP_API_KEY) {
    console.log("=== Magic Link Email (Dev Mode) ===")
    console.log(`To: ${to}`)
    console.log(`Subject: ${subject}`)
    console.log(html)
    console.log("===================================")
    return { success: true }
  }

  // Example: Using Resend
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SMTP_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.SMTP_FROM || "noreply@yourdomain.com",
        to,
        subject,
        html,
      }),
    })

    if (!response.ok) {
      throw new Error("Failed to send email")
    }

    return { success: true }
  } catch (error) {
    console.error("Email send error:", error)
    return { success: false, error }
  }
}

export function createMagicLinkEmail(magicLinkUrl: string) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Sign in to SecureChat</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; background: #0a0a0a; color: #fafafa;">
        <div style="max-width: 400px; margin: 0 auto; background: #171717; padding: 32px; border-radius: 12px; border: 1px solid #262626;">
          <h1 style="margin: 0 0 24px; font-size: 24px; font-weight: 600;">Sign in to SecureChat</h1>
          <p style="margin: 0 0 24px; color: #a1a1aa; line-height: 1.6;">
            Click the button below to securely sign in. This link expires in 15 minutes.
          </p>
          <a href="${magicLinkUrl}" style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
            Sign in to SecureChat
          </a>
          <p style="margin: 24px 0 0; color: #71717a; font-size: 14px;">
            If you didn't request this email, you can safely ignore it.
          </p>
        </div>
      </body>
    </html>
  `
}
