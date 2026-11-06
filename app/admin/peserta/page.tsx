import { Suspense } from "react";
import { AdminParticipants, AdminSkeleton } from "@/components/AdminParticipants";

export const metadata = { title: "Peserta — Admin KTA IKADI" };

export default function AdminPesertaPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminParticipants mode="list" />
    </Suspense>
  );
}
