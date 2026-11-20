import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { AdminParticipants, AdminSkeleton } from "@/components/AdminParticipants";
import { getSourceOptions } from "@/lib/queries";

export const metadata: Metadata = { title: "Anggota Wilayah | IKADI" };

export default function PengurusAnggotaPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AnggotaList />
    </Suspense>
  );
}

/**
 * Opsi filter sumber dibaca dari DB, jadi tidak bisa ikut di-prerender.
 * `connection()` menunda bagian ini ke request time; sisanya tetap static shell.
 */
async function AnggotaList() {
  await connection();
  const sourceOptions = await getSourceOptions();
  return (
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
  );
}
