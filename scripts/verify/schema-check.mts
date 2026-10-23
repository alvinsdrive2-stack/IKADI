// Runnable self-check. `npm run verify:schema`
import assert from "node:assert/strict";
import { participantSchema, normalizeNik, normalizeWhatsapp } from "../../lib/schema.ts";
import { maskNik, maskWhatsapp } from "../../lib/mask.ts";
import { rateLimit, resetRateLimit } from "../../lib/rate-limit.ts";

const base = {
  originType: "PW",
  originName: "  Jawa Timur ",
  fullName: "H. Ahmad Fauzi, S.Pd.",
  nik: "3576014241026002",
  birthPlace: "Surabaya",
  birthDate: "1980-05-17",
  address: "Jl. Raya No. 1",
  whatsapp: "085987654321",
  occupation: "Guru",
  sermonExperience: "SERING",
  quranReading: "TAJWID_BAIK",
  trainingReason: "Ingin memperdalam",
  trainingExpectation: "Bisa khutbah",
  consent: true,
};

const ok = participantSchema.safeParse(base);
assert.ok(ok.success, "baseline harus valid");
assert.equal(ok.data.originName, "Jawa Timur", "trim originName");
assert.equal(ok.data.lastEducation, undefined, "field opsional kosong jadi undefined");

const quoted = participantSchema.safeParse({ ...base, nik: " '3576014241026002 ", whatsapp: "'085987654321" });
assert.ok(quoted.success);
assert.equal(quoted.data.nik, "3576014241026002", "buang satu kutip + trim");
assert.equal(quoted.data.whatsapp, "085987654321", "WA tetap string, nol depan utuh");

for (const bad of ["357601424102600", "35760142410260021", "35760142410260x2", "", "1".repeat(16) + "'"]) {
  assert.equal(participantSchema.safeParse({ ...base, nik: bad }).success, false, `NIK invalid: ${bad}`);
}
assert.equal(participantSchema.safeParse({ ...base, birthDate: "2999-01-01" }).success, false, "tanggal masa depan");
assert.equal(participantSchema.safeParse({ ...base, consent: false }).success, false, "consent wajib true");
assert.equal(participantSchema.safeParse({ ...base, sermonExperience: "LAINNYA" }).success, false, "LAINNYA butuh teks");
const lain = participantSchema.safeParse({ ...base, sermonExperience: "LAINNYA", sermonExperienceOther: " Ustadz " });
assert.ok(lain.success);
assert.equal(lain.data.sermonExperienceOther, "Ustadz".length ? "Ustadz" : "", "trim other");
const bukanLain = participantSchema.safeParse({ ...base, sermonExperienceOther: "harus dibuang" });
assert.ok(bukanLain.success);
assert.equal(bukanLain.data.sermonExperienceOther, undefined, "selain LAINNYA di-strip");

assert.equal(normalizeNik("'087"), "087");
assert.equal(participantSchema.parse({ ...base, nik: "'3576014241026002" }).nik, "3576014241026002");
assert.equal(normalizeWhatsapp(" '+628123 "), "+628123");

assert.equal(maskNik("3576014241026002"), "3576********6002");
assert.equal(maskNik("3576014241026002").length, 16);

assert.equal(maskWhatsapp("085987654321"), "0859****4321");
assert.equal(maskWhatsapp("+6285987654321"), "+628****4321");
assert.equal(maskWhatsapp("08987654321").length, 12);
for (const short of ["", "0", "08598", "08598765"]) {
  assert.equal(maskWhatsapp(short), "****", `nomor pendek ${short} tidak boleh bocor`);
}

resetRateLimit();
for (let i = 0; i < 5; i++) assert.equal(rateLimit("t", 5, 1000).allowed, true);
const blocked = rateLimit("t", 5, 1000);
assert.equal(blocked.allowed, false, "hit ke-6 harus ditolak");
assert.ok(blocked.retryAfter >= 0);
assert.equal(rateLimit("other", 5, 1000).allowed, true, "key lain tidak terpengaruh");

console.log("schema-check: semua assert lolos");
