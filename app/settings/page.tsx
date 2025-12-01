import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { AppHeader } from "@/components/app-header"
import { SettingsForm } from "@/components/settings-form"
import { SecuritySettings } from "@/components/security-settings"

export default async function SettingsPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader user={user} />
      <main className="container max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>

        <div className="space-y-6">
          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Profile</h2>
            <SettingsForm user={user} />
          </section>

          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Security & Encryption</h2>
            <SecuritySettings />
          </section>

          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Sessions</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Manage your active sessions and sign out from other devices.
            </p>
            <form action="/api/auth/session" method="DELETE">
              <button type="submit" className="text-destructive text-sm font-medium hover:underline">
                Sign out from all devices
              </button>
            </form>
          </section>
        </div>
      </main>
    </div>
  )
}
