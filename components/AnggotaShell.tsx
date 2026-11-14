"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { AppFrame, AnggotaItems } from "@/components/AppFrame"

export function AnggotaShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState<string | undefined>(undefined)
  // null = belum tahu. Menu pengurus baru dirender setelah status pasti,
  // supaya tidak berkedip muncul lalu hilang.
  const [pengurus, setPengurus] = useState<{ aktif: boolean; label: string } | null>(null)

  useEffect(() => {
    fetch("/api/anggota/me", { cache: "no-store", credentials: "same-origin" })
      .then(async (r) => {
        if (r.status === 401) router.replace("/masuk")
        else if (r.ok) {
          const b = await r.json().catch(() => null)
          if (b?.data?.fullName) setName(b.data.fullName)
          const levelLabel = String(b?.data?.levelLabel ?? "")
          setPengurus({
            aktif: b?.data?.isPengurus === true,
            // levelLabel sudah berbunyi "Pengurus Pusat"; jangan ditambah lagi.
            label: levelLabel || "Pengurus",
          })
        } else {
          setPengurus({ aktif: false, label: "Akun anggota" })
        }
      })
      .catch(() => setPengurus({ aktif: false, label: "Akun anggota" }))
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
    <AppFrame
      role="anggota"
      items={AnggotaItems({ pengurus: pengurus?.aktif === true })}
      userLabel={name}
      roleLabel={pengurus?.aktif ? pengurus.label : undefined}
      onLogout={logout}
      logoutBusy={busy}
    >
      {children}
    </AppFrame>
  )
}
