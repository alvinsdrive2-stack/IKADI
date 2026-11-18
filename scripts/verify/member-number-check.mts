// Verifikasi lib/member-number.ts: format + urutan serial (tanpa DB).
// Jalankan: npm run verify:member-number
import assert from "node:assert/strict";
import {
  LEVEL_LABELS,
  formatMemberNumber,
  isValidLevel,
  issueMemberNumber,
} from "../../lib/member-number.ts";

// LEVEL_LABELS lengkap 1..7.
assert.deepEqual(Object.keys(LEVEL_LABELS).map(Number).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7]);
assert.equal(LEVEL_LABELS[1], "Pengurus Pusat");
assert.equal(LEVEL_LABELS[6], "Anggota");
assert.equal(LEVEL_LABELS[7], "Purnabakti / Mantan Pengurus");

// Format simpan: L.WW.DD.YY.NNNNN, YY = year mod 100 pad 2, serial pad 5.
assert.equal(formatMemberNumber(6, "16", "01", 2026, 1), "6.16.01.26.00001");
assert.equal(formatMemberNumber(7, "11", "71", 1999, 42), "7.11.71.99.00042");
assert.equal(formatMemberNumber(1, "31", "01", 2100, 12345), "1.31.01.00.12345");

// isValidLevel
assert.equal(isValidLevel(1), true);
assert.equal(isValidLevel(7), true);
assert.equal(isValidLevel(0), false);
assert.equal(isValidLevel(8), false);
assert.equal(isValidLevel(6.5), false);

// issueMemberNumber: mock tx client, simulasi increment serial 0001, 0002, dst.
function makeMockTx() {
  const store = new Map<string, number>();
  return {
    store,
    memberNumberSequence: {
      async upsert({
        where,
        create,
        update,
      }: {
        where: { provinceCode_regencyCode_year: { provinceCode: string; regencyCode: string; year: number } };
        create: { provinceCode: string; regencyCode: string; year: number; lastSerial: number };
        update: { lastSerial: { increment: number } };
      }) {
        const k = where.provinceCode_regencyCode_year;
        const key = `${k.provinceCode}.${k.regencyCode}.${k.year}`;
        const cur = store.get(key) ?? 0;
        // upsert: create jika belum ada (pakai lastSerial create), else increment.
        const next = cur === 0 ? create.lastSerial : cur + update.lastSerial.increment;
        store.set(key, next);
        return { lastSerial: next };
      },
    },
  };
}

const tx = makeMockTx();
const r1 = await issueMemberNumber(tx, { levelCode: 6, provinceCode: "16", regencyCode: "01", year: 2026 });
assert.equal(r1.memberNumber, "6.16.01.26.00100", "serial mulai di SERIAL_FLOOR");

const r2 = await issueMemberNumber(tx, { levelCode: 6, provinceCode: "16", regencyCode: "01", year: 2026 });
assert.equal(r2.memberNumber, "6.16.01.26.00101");

// Serial SATU seri per wilayah: level peserta berubah tidak memecah urutan.
const promoted = await issueMemberNumber(tx, { levelCode: 2, provinceCode: "16", regencyCode: "01", year: 2026 });
assert.equal(
  promoted.memberNumber,
  "2.16.01.26.00102",
  "level 2 melanjutkan serial wilayah yang sama, bukan mulai dari awal",
);

const nextYear = await issueMemberNumber(tx, { levelCode: 6, provinceCode: "16", regencyCode: "01", year: 2027 });
assert.equal(nextYear.memberNumber, "6.16.01.27.00100", "tahun beda -> serial baru");

const otherRegion = await issueMemberNumber(tx, { levelCode: 6, provinceCode: "16", regencyCode: "02", year: 2026 });
assert.equal(otherRegion.memberNumber, "6.16.02.26.00100", "wilayah beda -> serial baru");

console.log("member-number-check: semua assert lolos");
