"use client";

import { useState } from "react";
import { VerifikasiIntro } from "@/components/VerifikasiIntro";

/**
 * Bungkus halaman verifikasi: animasi pembuka dulu, lalu isi kartu.
 * Konten tetap dirender server dan sudah ada di HTML — animasi hanya
 * menutupinya, jadi tetap terbaca pengguna tanpa JS.
 */
export function VerifikasiGate({ children }: { children: React.ReactNode }) {
  const [done, setDone] = useState(false);

  return (
    <>
      {!done && <VerifikasiIntro onDone={() => setDone(true)} />}
      {/* `vpage-enter` memicu fade-in + skala dari kecil setelah animasi selesai. */}
      <div className={done ? "vpage-enter" : "vintro-hidden"}>{children}</div>
    </>
  );
}
