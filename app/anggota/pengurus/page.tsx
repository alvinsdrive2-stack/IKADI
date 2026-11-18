import type { Metadata } from "next";
import { PengurusHome } from "@/components/PengurusHome";

export const metadata: Metadata = { title: "Ringkasan Pengurus, IKADI" };

export default function PengurusPage() {
  return <PengurusHome />;
}
