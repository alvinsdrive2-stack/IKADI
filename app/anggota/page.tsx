import type { Metadata } from "next";
import { AnggotaHome } from "@/components/AnggotaHome";

export const metadata: Metadata = { title: "Dashboard Anggota — IKADI" };

export default function AnggotaPage() {
  return <AnggotaHome />;
}
