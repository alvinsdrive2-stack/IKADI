/**
 * Seed master wilayah (provinces + regencies) dari lib/wilayah.ts.
 * Idempotent: aman dijalankan berulang (pakai upsert).
 * Usage: npm run db:seed:wilayah
 */
import { config } from "dotenv";

// .env.local dulu (dipakai Next), lalu .env. dotenv tidak menimpa nilai yang sudah ada.
config({ path: ".env.local", quiet: true });
config({ quiet: true });

import { PROVINCES, REGENCIES } from "../lib/wilayah";
import { prisma } from "../lib/prisma";

async function main() {
  for (const p of PROVINCES) {
    await prisma.province.upsert({
      where: { code: p.code },
      create: { code: p.code, name: p.name },
      update: { name: p.name },
    });
  }

  // Regencies butuh FK ke provinces — sudah di-seed di atas.
  for (const r of REGENCIES) {
    await prisma.regency.upsert({
      where: { provinceCode_code: { provinceCode: r.provinceCode, code: r.code } },
      create: { provinceCode: r.provinceCode, code: r.code, name: r.name },
      update: { name: r.name },
    });
  }

  console.log(`Seed wilayah selesai: ${PROVINCES.length} provinsi, ${REGENCIES.length} kabupaten/kota (upsert idempotent).`);
}

main()
  .catch((err) => {
    console.error("Seed wilayah gagal:", err instanceof Error ? err.message : "unknown error");
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
