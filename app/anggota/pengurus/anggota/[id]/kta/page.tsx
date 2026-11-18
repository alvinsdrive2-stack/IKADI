import type { Metadata } from "next";
import { KtaCard } from "@/components/KtaCard";
import { readPengurus } from "@/lib/auth";
import { appointableLevels } from "@/lib/pengurus";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Cetak KTA | Pengurus IKADI" };

export default async function PengurusKtaPage({
  params,
}: PageProps<"/anggota/pengurus/anggota/[id]/kta">) {
  const { id } = await params;
  const actor = await readPengurus();
  if (!actor) redirect("/anggota");

  return (
    <KtaCard
      id={id}
      apiBase="/api/anggota/pengurus/anggota"
      basePath="/anggota/pengurus/anggota"
      allowedLevels={appointableLevels(actor)}
    />
  );
}
