import type { Metadata } from "next";
import { ChangePassword } from "@/components/ChangePassword";

export const metadata: Metadata = { title: "Ganti Sandi Admin | IKADI" };

export default function AdminGantiSandiPage() {
  return (
    <ChangePassword
      // Admin tidak punya penanda wajib-ganti; formulirnya selalu bisa dibuka.
      meUrl="/api/admin/me"
      endpoint="/api/admin/sandi"
      title="Ganti sandi admin"
      redirectTo="/admin"
    />
  );
}
