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
  gender: "LAKI_LAKI",
  maritalStatus: "SUDAH_MENIKAH",
  bloodType: "O",
  addressKtp: "Jl. Raya No. 1, Kec. Taman",
  addressSameAsKtp: true,
  province: "Jawa Timur",
  city: "Sidoarjo",
  address: "Jl. Raya No. 1",
  whatsapp: "085987654321",
  occupation: "Guru",
  sermonExperience: "SERING",
  quranReading: "TAJWID_BAIK",
  trainingReason: "Ingin memperdalam",
  trainingExpectation: "Bisa khutbah",
  consent: true,
  ktp: "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
};

const ok = participantSchema.safeParse(base);
assert.ok(ok.success, "baseline harus valid");

// Foto KTP wajib (diambil dari kamera di form).
assert.equal(participantSchema.safeParse({ ...base, ktp: undefined }).success, false, "ktp kosong harus ditolak");
assert.equal(participantSchema.safeParse({ ...base, ktp: "   " }).success, false, "ktp spasi harus ditolak");
assert.equal(
  participantSchema.safeParse({ ...base, ktp: "data:image/gif;base64,R0lGOD" }).success,
  false,
  "ktp gif harus ditolak",
);
assert.equal(ok.data.originName, "Jawa Timur", "trim originName");
assert.equal(ok.data.lastEducation, undefined, "field opsional kosong jadi undefined");
assert.equal(ok.data.addressCurrent, base.addressKtp, "alamat tinggal ikut KTP saat dicentang");
assert.equal(ok.data.address, base.addressKtp, "kolom legacy address fallback ke addressKtp");

// Checkbox dilepas -> addressCurrent jadi wajib.
assert.equal(
  participantSchema.safeParse({ ...base, addressSameAsKtp: false, addressCurrent: undefined }).success,
  false,
  "beda alamat tanpa addressCurrent harus gagal",
);
const beda = participantSchema.safeParse({
  ...base,
  addressSameAsKtp: false,
  addressCurrent: " Jl. Baru No. 9 ",
});
assert.ok(beda.success);
assert.equal(beda.data.addressCurrent, "Jl. Baru No. 9", "trim addressCurrent");
assert.equal(beda.data.address, "Jl. Baru No. 9", "kolom legacy address pakai addressCurrent");

for (const k of ["maritalStatus", "bloodType", "addressKtp", "province", "city"] as const) {
  const { [k]: _drop, ...rest } = base;
  assert.equal(participantSchema.safeParse(rest).success, false, `field wajib hilang: ${k}`);
}

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
