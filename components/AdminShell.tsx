"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { AppFrame, AdminItems } from "@/components/AppFrame"

export function AdminShell({ children, username }: { children: React.ReactNode; username?: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const logout = async () => {
    if (busy) return
    setBusy(true)
    try {
      await fetch("/api/admin/logout", {
        method: "POST",
        credentials: "same-origin",
        // Tanpa batas waktu, request yang menggantung membuat tombol tertahan
        // di "Keluar..." selamanya.
        signal: AbortSignal.timeout(8000),
      })
    } catch {
      // Server tidak menjawab: tetap keluar dari halaman ini.
    } finally {
      // Wajib di-reset supaya tombol tidak tertinggal nonaktif kalau navigasi gagal.
      setBusy(false)
    }
    router.replace("/masuk")
    router.refresh()
  }

  return (
    <AppFrame
      role="admin"
      items={AdminItems()}
      userLabel={username}
      onLogout={logout}
      logoutBusy={busy}
      changePasswordHref="/admin/ganti-sandi"
    >
      {children}
    </AppFrame>
  )
}
