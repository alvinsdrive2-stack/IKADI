import { redirect } from "next/navigation";
import { readPengurus } from "@/lib/auth";

/**
 * Guard server-side area pengurus.
 *
 * Menyembunyikan menu saja tidak cukup: siapa pun bisa mengetik URL.
 * Sesi dibaca di dalam komponen ber-cache privat supaya redirect tidak ikut
 * ter-cache lintas pengguna.
 */
async function PengurusGuard({ children }: { children: React.ReactNode }) {
  "use cache: private";
  const actor = await readPengurus();
  if (!actor) redirect("/anggota");
  return children;
}

export default function PengurusLayout({ children }: { children: React.ReactNode }) {
  return <PengurusGuard>{children}</PengurusGuard>;
}
