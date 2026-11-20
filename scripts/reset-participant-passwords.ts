/**
 * Reset sandi semua peserta (bukan admin) ke satu sandi sementara dan tandai
 * wajib ganti sandi pada login berikutnya.
 *
 *   npx tsx scripts/reset-participant-passwords.ts            # dry-run
 *   npx tsx scripts/reset-participant-passwords.ts --apply    # benar-benar menulis
 *
 * Aturan:
 * - Semua peserta kena, termasuk yang belum pernah punya sandi.
 * - Sandi sementara seragam (`TEMP_PASSWORD`), jadi hash dihitung sekali lalu
 *   dipakai untuk semua baris.
 * - `must_change_password = true` supaya gate di area anggota memaksa ganti
 *   sandi sebelum menu lain dipakai.
 * - Idempoten: menjalankan ulang hanya mengulang reset yang sama.
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";
import { TEMP_PASSWORD } from "../lib/munas-password";

const APPLY = process.argv.includes("--apply");

async function main() {
  const db = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL!) });

  try {
    const total = await db.participant.count();
    const already = await db.participant.count({ where: { mustChangePassword: true } });

    console.log(APPLY ? "MODE: APPLY (menulis)" : "MODE: DRY-RUN (tidak menulis)");
    console.log(`Peserta            : ${total}`);
    console.log(`Sudah ditandai ganti: ${already}`);
    console.log(`Sandi sementara    : ${TEMP_PASSWORD}`);

    if (!APPLY) {
      console.log("\nJalankan ulang dengan --apply untuk menulis.");
      return;
    }

    // Satu hash untuk semua baris: argon2 mahal, dan sandinya memang seragam.
    const passwordHash = await hashPassword(TEMP_PASSWORD);
    const r = await db.participant.updateMany({
      data: { passwordHash, mustChangePassword: true },
    });
    console.log(`\nSelesai. Diubah: ${r.count} baris.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
