import type { Metadata } from "next";
import { KtaCoordLab } from "@/components/KtaCoordLab";

export const metadata: Metadata = {
  title: "Lab koordinat KTA — Admin IKADI",
};

// Global: satu set koordinat untuk semua kartu. Tanpa fetch, tanpa kuota cetak.
export default function KtaCoordPage() {
  return <KtaCoordLab />;
}
