import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminParticipants, AdminSkeleton } from "@/components/AdminParticipants";
import { getSourceOptions } from "@/lib/queries";

export const metadata: Metadata = { title: "Peserta | Admin KTA IKADI" };

// Opsi filter sumber dibaca dari DB, jadi halaman ini tidak bisa statis.
export const instant = false;

export default async function AdminPesertaPage() {
  const sourceOptions = await getSourceOptions();
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminParticipants mode="list" sourceOptions={sourceOptions} />
    </Suspense>
  );
}
