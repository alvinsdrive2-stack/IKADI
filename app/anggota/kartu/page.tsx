import type { Metadata } from "next";
import { AnggotaKartu } from "@/components/AnggotaKartu";

export const metadata: Metadata = { title: "Kartu Anggota — IKADI" };

export default function AnggotaKartuPage() {
  return <AnggotaKartu />;
}
