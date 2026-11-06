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
assert.equal(LEVEL_LABELS[1], "Pusat");
assert.equal(LEVEL_LABELS[6], "Anggota");
assert.equal(LEVEL_LABELS[7], "Purnabakti");

// Format: L.WW.DD.YY.NNNN, YY = year mod 100 pad 2, NNNN pad 4.
assert.equal(formatMemberNumber(6, "16", "01", 2026, 1), "6.16.01.26.0001");
assert.equal(formatMemberNumber(7, "11", "71", 1999, 42), "7.11.71.99.0042");
assert.equal(formatMemberNumber(1, "31", "01", 2100, 12345), "1.31.01.00.12345");

// isValidLevel
assert.equal(isValidLevel(1), true);
assert.equal(isValidLevel(7), true);
assert.equal(isValidLevel(0), false);
assert.equal(isValidLevel(8), false);
assert.equal(isValidLevel(6.5), false);

// issueMemberNumber: mock tx client — simulasi increment serial 0001, 0002, dst.
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
        where: { levelCode_provinceCode_regencyCode_year: { levelCode: number; provinceCode: string; regencyCode: string; year: number } };
        create: { levelCode: number; provinceCode: string; regencyCode: string; year: number; lastSerial: number };
        update: { lastSerial: { increment: number } };
      }) {
        const k = where.levelCode_provinceCode_regencyCode_year;
        const key = `${k.levelCode}.${k.provinceCode}.${k.regencyCode}.${k.year}`;
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
assert.deepEqual(r1, { memberNumber: "6.16.01.26.0001", serial: 1 });

const r2 = await issueMemberNumber(tx, { levelCode: 6, provinceCode: "16", regencyCode: "01", year: 2026 });
assert.deepEqual(r2, { memberNumber: "6.16.01.26.0002", serial: 2 });

const r3 = await issueMemberNumber(tx, { levelCode: 6, provinceCode: "16", regencyCode: "01", year: 2026 });
assert.deepEqual(r3, { memberNumber: "6.16.01.26.0003", serial: 3 });

// Serial terpisah per (level, provinsi, kab/kota, tahun).
const other = await issueMemberNumber(tx, { levelCode: 7, provinceCode: "16", regencyCode: "01", year: 2026 });
assert.equal(other.memberNumber, "7.16.01.26.0001", "level beda -> serial mulai 0001");

const nextYear = await issueMemberNumber(tx, { levelCode: 6, provinceCode: "16", regencyCode: "01", year: 2027 });
assert.equal(nextYear.memberNumber, "6.16.01.27.0001", "tahun beda -> serial mulai 0001");

console.log("member-number-check: semua assert lolos");
