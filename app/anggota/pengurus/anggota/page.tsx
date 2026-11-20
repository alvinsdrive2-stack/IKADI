import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminParticipants, AdminSkeleton } from "@/components/AdminParticipants";
import { getSourceOptions } from "@/lib/queries";

export const metadata: Metadata = { title: "Anggota Wilayah | IKADI" };

// Opsi filter sumber dibaca dari DB, jadi halaman ini tidak bisa statis.
export const instant = false;

export default async function PengurusAnggotaPage() {
  const sourceOptions = await getSourceOptions();
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminParticipants
        mode="list"
        basePath="/anggota/pengurus/anggota"
        apiBase="/api/anggota/pengurus/anggota"
        // Ringkasan lintas wilayah milik admin; pengurus punya /me sendiri.
        statsUrl={null}
        bulkExportBase="/api/anggota/pengurus/bulk/kta"
        bulkIssueUrl="/api/anggota/pengurus/bulk/terbitkan"
        sourceOptions={sourceOptions}
      />
    </Suspense>
  );
}
