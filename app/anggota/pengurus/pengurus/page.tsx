import type { Metadata } from "next";
import { PengurusAdmin } from "@/components/PengurusAdmin";

export const metadata: Metadata = { title: "Pengurus | IKADI" };

export default function PengurusKelolaPage() {
  return <PengurusAdmin />;
}
