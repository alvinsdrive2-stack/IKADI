import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AnggotaHome } from "@/components/AnggotaHome";

export const metadata: Metadata = { title: "Status Pengajuan — IKADI" };

export default function AnggotaStatusPage() {
  return (
    <div className="space-y-5">
      <Link href="/anggota" className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-ink-muted transition-colors hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> Kembali
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Status pengajuan</h1>
        <p className="mt-1.5 text-sm text-ink-muted">Posisi pengajuan KTA Anda saat ini.</p>
      </div>
      <AnggotaHome variant="status" />
    </div>
  );
}
