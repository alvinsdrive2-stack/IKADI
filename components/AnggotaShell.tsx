"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { AppFrame, AnggotaItems } from "@/components/AppFrame"

export function AnggotaShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
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
          // Peserta hasil impor wajib melengkapi profil dulu. Gate di sini, bukan
          // per halaman, supaya semua menu ikut terkunci.
          if (b?.data?.needsProfileCompletion === true && !pathname.startsWith("/anggota/lengkapi")) {
            router.replace("/anggota/lengkapi")
            return
          }
          // Sandi hasil reset massal (tanggal lahir) wajib diganti sebelum
          // anggota memakai menu lain. Pelengkapan profil sudah memuat ganti
          // sandi, jadi gate itu didahulukan.
          if (b?.data?.mustChangePassword === true && !pathname.startsWith("/anggota/ganti-sandi")) {
            router.replace("/anggota/ganti-sandi")
            return
          }
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
  }, [router, pathname])

  const logout = async () => {
    if (busy) return
    setBusy(true)
    try {
      await fetch("/api/anggota/logout", {
        method: "POST",
        credentials: "same-origin",
        // Tanpa batas waktu, request yang menggantung membuat tombol tertahan
        // di "Keluar..." selamanya.
        signal: AbortSignal.timeout(8000),
      })
    } catch {
      // Server tidak menjawab: tetap keluar dari halaman ini. Cookie kedaluwarsa
      // sendiri, dan pengguna bisa mencoba lagi setelah masuk.
    } finally {
      // Wajib di-reset: kalau navigasi gagal atau lambat, tombol tidak boleh
      // tertinggal dalam keadaan nonaktif tanpa jalan keluar.
      setBusy(false)
    }
    router.replace("/masuk")
    router.refresh()
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
