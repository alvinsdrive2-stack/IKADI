import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminParticipants, AdminSkeleton } from "@/components/AdminParticipants";

export const metadata: Metadata = { title: "Anggota Wilayah, IKADI" };

export default function PengurusAnggotaPage() {
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
      />
    </Suspense>
  );
}
