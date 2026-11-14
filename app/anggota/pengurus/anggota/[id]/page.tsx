import type { Metadata } from "next";
import { ParticipantDetail } from "@/components/ParticipantDetail";
import { readPengurus } from "@/lib/auth";
import { appointableLevels } from "@/lib/pengurus";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Detail Anggota — Pengurus IKADI" };

export default async function PengurusAnggotaDetailPage({
  params,
}: PageProps<"/anggota/pengurus/anggota/[id]">) {
  const { id } = await params;
  const actor = await readPengurus();
  if (!actor) redirect("/anggota");

  return (
    <ParticipantDetail
      id={id}
      apiBase="/api/anggota/pengurus/anggota"
      basePath="/anggota/pengurus/anggota"
      allowedLevels={appointableLevels(actor)}
      actorLevel={actor.levelCode}
    />
  );
}
