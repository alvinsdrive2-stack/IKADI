/**
 * Backfill `member_cards` dari `participants.member_number` yang sudah terbit
 * sebelum tabel riwayat ada. Idempoten, aman dijalankan berulang.
 *
 *   npx tsx scripts/backfill-member-cards.ts
 */
import { backfillMemberCards } from "../lib/member-cards";
import { prisma } from "../lib/prisma";

async function main() {
  const r = await backfillMemberCards();
  console.log(`member_cards backfill: dibuat ${r.created}, dilewati ${r.skipped}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
