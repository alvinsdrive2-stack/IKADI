import { Suspense } from "react";
import { AdminParticipants, AdminSkeleton } from "@/components/AdminParticipants";

export const metadata = {
  title: "Dashboard — Admin KTA IKADI",
};

export default function AdminPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminParticipants />
    </Suspense>
  );
}
