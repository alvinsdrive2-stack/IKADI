/**
 * Verifikasi logika kartu anggota yang tidak butuh DB:
 * format nomor manual dan bentuk tampilan nomor.
 *
 *   npx tsx scripts/verify/member-cards-check.mts
 */
import assert from "node:assert/strict";
import { MEMBER_NUMBER_RE } from "../../lib/member-cards";
import { displayMemberNumber } from "../../lib/member-number";

const valid = ["6.16.01.26.00100", "1.31.71.26.00123", "3.32.03.25.99999", "6.16.01.26.0001"];
for (const n of valid) {
  assert.equal(MEMBER_NUMBER_RE.test(n), true, `format valid ditolak: ${n}`);
}

const invalid = [
  "160126.00100", // bentuk tampilan, bukan bentuk simpan
  "6.16.01.26", // serial hilang
  "8.16.01.26.00100", // level di luar 1..7
  "6.1.01.26.00100", // provinsi bukan 2 digit
  "6.16.01.26.001", // serial 3 digit
  " 6.16.01.26.00100 ", // spasi dianggap tidak valid (pemanggil yang trim)
];
for (const n of invalid) {
  assert.equal(MEMBER_NUMBER_RE.test(n), false, `format tidak valid diterima: ${n}`);
}

assert.equal(displayMemberNumber("6.16.01.26.00100"), "160126.00100");
assert.equal(displayMemberNumber("6.16.01.26.0001"), "160126.0001");

console.log("member-cards check: ok");
