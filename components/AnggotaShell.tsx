"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { AppFrame, AnggotaItems } from "@/components/AppFrame"

export function AnggotaShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState<string | undefined>(undefined)

  useEffect(() => {
    fetch("/api/anggota/me", { cache: "no-store", credentials: "same-origin" })
      .then(async (r) => {
        if (r.status === 401) router.replace("/masuk")
        else if (r.ok) {
          const b = await r.json().catch(() => null)
          if (b?.data?.fullName) setName(b.data.fullName)
        }
      })
      .catch(() => {})
  }, [router])

  const logout = async () => {
    setBusy(true)
    try {
      await fetch("/api/anggota/logout", { method: "POST" })
    } finally {
      router.replace("/masuk")
      router.refresh()
    }
  }

  return (
    <AppFrame role="anggota" items={AnggotaItems()} userLabel={name} onLogout={logout} logoutBusy={busy}>
      {children}
    </AppFrame>
  )
}
