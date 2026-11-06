import type { Metadata } from "next";
import { KtaCard } from "@/components/KtaCard";

export const metadata: Metadata = {
  title: "Cetak KTA — Admin IKADI",
};

// `id` dibaca di client component; otorisasi tetap di API.
export default async function KtaPage({
  params,
}: PageProps<"/admin/peserta/[id]/kta">) {
  const { id } = await params;
  return <KtaCard id={id} />;
}
