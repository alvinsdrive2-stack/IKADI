/**
 * Isi tabel `data_sources` dan hubungkan peserta hasil impor ke sumbernya.
 *
 *   npx tsx scripts/seed-data-sources.ts
 *
 * Idempoten: sumber memakai `key` unik (upsert), dan hanya peserta yang belum
 * punya `source_id` yang dihubungkan. Peserta impor dikenali dari
 * `needs_profile_completion` yang masih aktif.
 */
import { prisma } from "../lib/prisma";

/** Definisi sumber. Tambah baris di sini kalau ada impor baru. */
const SOURCES = [
  {
    key: "munas-iv-2026",
    label: "MUNAS IV IKADI 2026",
    origin: "Database munas_ikadi, tabel participants",
    note: "Diimpor 18 November 2026 dari pendataan MUNAS. Data tempat lahir, alamat, dan pekerjaan belum ada di sumber.",
  },
] as const;

async function main() {
  for (const s of SOURCES) {
    const row = await prisma.dataSource.upsert({
      where: { key: s.key },
      create: { key: s.key, label: s.label, origin: s.origin, note: s.note },
      update: { label: s.label, origin: s.origin, note: s.note },
    });
    console.log(`sumber ${row.key} id=${row.id}`);
  }

  const munas = await prisma.dataSource.findUnique({ where: { key: "munas-iv-2026" } });
  if (!munas) throw new Error("sumber munas-iv-2026 tidak ditemukan");

  // Peserta impor = penanda pelengkapan profil masih aktif dan belum punya sumber.
  const res = await prisma.participant.updateMany({
    where: { needsProfileCompletion: true, sourceId: null },
    data: { sourceId: munas.id },
  });
  console.log(`peserta ditandai sumber: ${res.count}`);

  const total = await prisma.participant.count({ where: { sourceId: munas.id } });
  const masihKosong = await prisma.participant.count({
    where: { needsProfileCompletion: true, sourceId: null },
  });
  console.log(`total peserta bersumber ${munas.key}: ${total}`);
  console.log(`masih tanpa sumber: ${masihKosong}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
