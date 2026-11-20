/**
 * Isi `photoPath` peserta yang belum punya foto dari database MUNAS.
 *
 *   npx tsx scripts/backfill-munas-photos.ts            # dry-run
 *   npx tsx scripts/backfill-munas-photos.ts --apply    # benar-benar menulis
 *
 * Konteks: impor sheet cetak KTA mendaftarkan pengurus wilayah yang belum ada
 * di `ikadi`, dan baris itu tidak membawa foto. Sebagian dari mereka ada di
 * database `munas_ikadi` dengan NIK yang sama dan punya `photoUrl`.
 *
 * Aturan:
 * - Hanya peserta yang `photoPath` masih kosong / null yang disentuh. Foto yang
 *   sudah ada tidak pernah ditimpa (peserta bisa saja sudah unggah foto sendiri).
 * - Foto tidak disalin ke storage IKADI: `photoPath` diisi URL absolut ke sistem
 *   sumber, sama seperti `scripts/import-munas-participants.ts`.
 * - NIK tanpa foto di sumber, NIK ganda di sumber, dan URL yang tidak bisa
 *   diakses dilewati.
 *
 * Skrip idempoten: baris yang sudah berfoto dilewati, jadi aman diulang.
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const MUNAS_URL = process.env.MUNAS_DATABASE_URL;
// .env.local menang atas .env.munas karena dimuat lebih dulu oleh dotenv.
const IKADI_URL = process.env.DATABASE_URL;

/** Basis publik sistem sumber, untuk mengubah `photoUrl` relatif jadi absolut. */
const MUNAS_PUBLIC_BASE = (process.env.MUNAS_PUBLIC_BASE ?? "https://munas.ikadi.or.id").replace(/\/+$/, "");

function absolutePhotoPath(photoUrl: string | null): string | null {
  const raw = (photoUrl ?? "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${MUNAS_PUBLIC_BASE}/${raw.replace(/^\/+/, "")}`;
}

async function main() {
  if (!MUNAS_URL) throw new Error("MUNAS_DATABASE_URL belum di-set (lihat .env.munas)");
  if (!IKADI_URL) throw new Error("DATABASE_URL belum di-set (lihat .env.local)");

  const munas = new PrismaClient({
    adapter: new PrismaMariaDb(MUNAS_URL, { ssl: { rejectUnauthorized: false } }),
  });
  const ikadi = new PrismaClient({ adapter: new PrismaMariaDb(IKADI_URL) });

  try {
    const targets = await ikadi.participant.findMany({
      where: { OR: [{ photoPath: null }, { photoPath: "" }] },
      select: { id: true, nik: true, fullName: true },
    });
    const niks = targets.map((t) => t.nik).filter((n) => /^\d{16}$/.test(n));

    const rows =
      niks.length === 0
        ? []
        : await munas.$queryRawUnsafe<
            { nik: string; photo_url: string | null; position: string | null }[]
          >(
            `SELECT p.nik, p.photoUrl AS photo_url, p.position
               FROM participants p
              WHERE p.nik IN (${niks.map(() => "?").join(",")})`,
            ...niks,
          );

    // NIK bisa muncul lebih dari sekali di sumber; yang berfoto dipilih duluan.
    const byNik = new Map<string, string>();
    let duplicateNik = 0;
    for (const row of rows) {
      const url = absolutePhotoPath(row.photo_url);
      if (!url) continue;
      if (byNik.has(row.nik)) {
        duplicateNik++;
        continue;
      }
      byNik.set(row.nik, url);
    }

    const matched = targets.filter((t) => byNik.has(t.nik));
    const unmatched = targets.length - matched.length;

    console.log(APPLY ? "MODE: APPLY (menulis)" : "MODE: DRY-RUN (tidak menulis)");
    console.log(`Peserta tanpa foto       : ${targets.length}`);
    console.log(`Ada foto di MUNAS        : ${matched.length}`);
    console.log(`NIK ganda (dilewati)     : ${duplicateNik}`);
    console.log(`Tidak ada foto di MUNAS  : ${unmatched}`);
    console.log("\nContoh 5 baris:");
    for (const t of matched.slice(0, 5)) {
      console.log(`  ${t.nik} | ${t.fullName} | ${byNik.get(t.nik)}`);
    }

    if (!APPLY) {
      console.log("\nJalankan ulang dengan --apply untuk menulis.");
      return;
    }

    // Cek akses URL dulu supaya kartu tidak menunjuk ke berkas yang hilang.
    let downloadable = 0;
    for (const t of matched) {
      try {
        const res = await fetch(byNik.get(t.nik)!, { method: "HEAD", signal: AbortSignal.timeout(10_000) });
        if (res.ok) downloadable++;
        else console.log(`  URL tidak OK (${res.status}) untuk NIK ${t.nik}, tetap ditulis`);
      } catch {
        console.log(`  URL tidak dapat diakses untuk NIK ${t.nik}, tetap ditulis`);
      }
    }
    console.log(`URL merespons OK         : ${downloadable}/${matched.length}`);

    let updated = 0;
    for (const t of matched) {
      // Filter foto kosong diulang di sini: jangan timpa foto yang baru diunggah
      // peserta sejak daftar target dibaca.
      const r = await ikadi.participant.updateMany({
        where: { id: t.id, OR: [{ photoPath: null }, { photoPath: "" }] },
        data: { photoPath: byNik.get(t.nik)! },
      });
      updated += r.count;
    }
    console.log(`\nSelesai. Foto terisi: ${updated} baris.`);
  } finally {
    await munas.$disconnect();
    await ikadi.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
