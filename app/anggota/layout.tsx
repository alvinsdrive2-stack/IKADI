import { AnggotaShell } from "@/components/AnggotaShell";

export const metadata = {
  title: "Anggota, Dashboard IKADI",
};

// Area ini butuh sesi (cookie) di guard pengurus, jadi tidak bisa dirender
// statis. Tanpa ini, `next build` gagal dengan blocking-prerender-dynamic.
export const instant = false;

export default function AnggotaLayout({ children }: { children: React.ReactNode }) {
  return <AnggotaShell>{children}</AnggotaShell>;
}
