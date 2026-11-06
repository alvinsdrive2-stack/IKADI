"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { AppFrame, AdminItems } from "@/components/AppFrame"

export function AdminShell({ children, username }: { children: React.ReactNode; username?: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const logout = async () => {
    setBusy(true)
    try {
      await fetch("/api/admin/logout", { method: "POST" })
    } finally {
      router.replace("/masuk")
      router.refresh()
    }
  }

  return (
    <AppFrame role="admin" items={AdminItems()} userLabel={username} onLogout={logout} logoutBusy={busy}>
      {children}
    </AppFrame>
  )
}
