import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { AdminParticipants, AdminSkeleton } from "@/components/AdminParticipants";
import { getSourceOptions } from "@/lib/queries";

export const metadata: Metadata = { title: "Peserta | Admin KTA IKADI" };

export default function AdminPesertaPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <PesertaList />
    </Suspense>
  );
}

/**
 * Opsi filter sumber dibaca dari DB, jadi tidak bisa ikut di-prerender.
 * `connection()` menunda bagian ini ke request time; sisanya tetap static shell.
 */
async function PesertaList() {
  await connection();
  const sourceOptions = await getSourceOptions();
  return <AdminParticipants mode="list" sourceOptions={sourceOptions} />;
}
