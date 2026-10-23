import type { Metadata } from "next";
import { ParticipantDetail } from "@/components/ParticipantDetail";

export const metadata: Metadata = {
  title: "Detail Peserta — Admin KTA IKADI",
};

// `id` dibaca di client component lewat prop ini (bukan di page) supaya page tidak
// memaksa dynamic params jadi bagian static shell; otorisasi tetap di API.
export default async function PesertaDetailPage({
  params,
}: PageProps<"/admin/peserta/[id]">) {
  const { id } = await params;
  return <ParticipantDetail id={id} />;
}
