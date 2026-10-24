// Pure lib-level checks: zod schema, masking, rate limit. No DB, no Next.
// Run: npm run verify:qa
import assert from "node:assert/strict";
import test from "node:test";
import { participantSchema, loginSchema, normalizeNik, normalizeWhatsapp } from "../lib/schema.ts";
import { maskNik } from "../lib/mask.ts";
import { rateLimit, resetRateLimit } from "../lib/rate-limit.ts";

const base = {
  originType: "PW",
  originName: "  Jawa Timur ",
  fullName: "H. Ahmad Fauzi, S.Pd.",
  nik: "3576014241026002",
  birthPlace: "Surabaya",
  birthDate: "1980-05-17",
  gender: "LAKI_LAKI",
  photo: "data:image/png;base64," + Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]).toString("base64"),
  address: "Jl. Raya No. 1",
  whatsapp: "085987654321",
  occupation: "Guru",
  sermonExperience: "SERING",
  quranReading: "TAJWID_BAIK",
  trainingReason: "Ingin memperdalam",
  trainingExpectation: "Bisa khutbah",
  consent: true,
};

const parse = (patch: Record<string, unknown>) => participantSchema.safeParse({ ...base, ...patch });

test("baseline valid + trim", () => {
  const r = parse({});
  assert.ok(r.success);
  assert.equal(r.data.originName, "Jawa Timur");
  assert.equal(r.data.lastEducation, undefined);
});

test("AC-04: NIK harus tepat 16 digit angka", () => {
  for (const nik of ["357601424102600", "35760142410260021", "35760142410260X2", "3576-0142-4102-6002", "  "]) {
    assert.equal(parse({ nik }).success, false, `NIK seharusnya ditolak: "${nik}"`);
  }
  for (const ok of ["3576014241026002", " 3576014241026002 ", "\t1234567890123456\n"]) {
    assert.equal(parse({ nik: ok }).success, true, `NIK seharusnya diterima: "${ok}"`);
  }
});

test("AC-04b: NIK non-string ditolak", () => {
  for (const v of [3576014241026002, null, undefined, ["3576014241026002"]]) {
    assert.equal(parse({ nik: v }).success, false);
  }
});

test("AC-07: satu kutip awal dibuang, kutip di tengah/dua kutip tidak", () => {
  assert.equal(parse({ nik: "'3576014241026002" }).success, true);
  const quoted = participantSchema.parse({ ...base, nik: "'3576014241026002" });
  assert.equal(quoted.nik, "3576014241026002");
  assert.equal(normalizeNik("'3576014241026002"), "3576014241026002");
  assert.equal(normalizeNik(" '3576014241026002 "), "3576014241026002");
  assert.equal(normalizeNik("''3576014241026002"), "'3576014241026002");
  assert.equal(parse({ nik: "3576'014241026002" }).success, false, "kutip di tengah tidak dibuang");
  assert.equal(parse({ nik: "''3576014241026002" }).success, false, "dua kutip hanya buang satu");
});

test("AC-08: WA tetap string, awalan 0 / +62 utuh", () => {
  for (const [input, saved] of [
    ["085987654321", "085987654321"],
    ["'085987654321", "085987654321"],
    ["+6285987654321", "+6285987654321"],
    ["62859876543210", "62859876543210"],
  ]) {
    const r = parse({ whatsapp: input });
    assert.ok(r.success, `WA seharusnya diterima: ${input}`);
    assert.equal(r.data.whatsapp, saved);
    assert.equal(typeof r.data.whatsapp, "string");
  }
  for (const bad of ["85987654321", "08598765432101234", "08-5987-654321", "+6 285987654321"]) {
    assert.equal(parse({ whatsapp: bad }).success, false, `WA seharusnya ditolak: ${bad}`);
  }
  assert.equal(normalizeWhatsapp(" '+628123 "), "+628123");
});

test("AC-03: setiap field wajib menolak string kosong / spasi / hilang", () => {
  const required = ["originType", "originName", "fullName", "nik", "birthPlace", "birthDate", "address", "whatsapp", "occupation", "sermonExperience", "quranReading", "trainingReason", "trainingExpectation"];
  for (const field of required) {
    for (const blank of ["", "   "]) {
      const r = parse({ [field]: blank });
      assert.equal(r.success, false, `${field} kosong harus ditolak`);
      if (!r.success) assert.ok(r.error.issues.some((i) => i.path[0] === field), `error harus menunjuk ${field}`);
    }
    const missing: Record<string, unknown> = { ...base };
    delete missing[field];
    assert.equal(participantSchema.safeParse(missing).success, false, `${field} hilang harus ditolak`);
  }
});

test("consent harus literal true", () => {
  for (const v of [false, "true", 1, null, undefined]) {
    assert.equal(parse({ consent: v }).success, false, `consent ${String(v)} harus ditolak`);
  }
});

test("birthDate: format, tanggal mustahil, masa depan", () => {
  for (const bad of ["1980-5-17", "17-05-1980", "1980-02-30", "1980-13-01", "2999-01-01", "not-a-date", ""]) {
    assert.equal(parse({ birthDate: bad }).success, false, `tanggal harus ditolak: ${bad}`);
  }
  assert.equal(parse({ birthDate: "1900-01-01" }).success, true);
  const tomorrow = new Date(Date.now() + 86_400_000);
  const iso = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  assert.equal(parse({ birthDate: iso }).success, false, "besok harus ditolak");
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  assert.equal(parse({ birthDate: todayIso }).success, true, "hari ini diterima");
});

test("sermonExperience: LAINNYA wajib teks, selain itu teks dibuang", () => {
  assert.equal(parse({ sermonExperience: "LAINNYA" }).success, false);
  assert.equal(parse({ sermonExperience: "LAINNYA", sermonExperienceOther: "  " }).success, false);
  const lain = parse({ sermonExperience: "LAINNYA", sermonExperienceOther: "  Pernah sekali " });
  assert.ok(lain.success);
  assert.equal(lain.data.sermonExperienceOther, "Pernah sekali");
  for (const v of ["SERING", "KADANG_KADANG", "BELUM_PERNAH"]) {
    const r = parse({ sermonExperience: v, sermonExperienceOther: "harus dibuang" });
    assert.ok(r.success);
    assert.equal(r.data.sermonExperienceOther, undefined, `${v} tidak boleh simpan teks lain`);
  }
});

test("enum asing ditolak", () => {
  assert.equal(parse({ originType: "PWK" }).success, false);
  assert.equal(parse({ originType: "pw" }).success, false);
  assert.equal(parse({ quranReading: "TAJWID" }).success, false);
  assert.equal(parse({ sermonExperience: "" }).success, false);
});

test("field opsional: kosong -> undefined, spasi di-trim", () => {
  const r = parse({ lastEducation: "  ", expertise: " fiqih ", organizationExperience: "" });
  assert.ok(r.success);
  assert.equal(r.data.lastEducation, undefined);
  assert.equal(r.data.expertise, "fiqih");
  assert.equal(r.data.organizationExperience, undefined);
});

test("batas panjang field", () => {
  assert.equal(parse({ originName: "x".repeat(151) }).success, false);
  assert.equal(parse({ originName: "x".repeat(150) }).success, true);
  assert.equal(parse({ nik: "1".repeat(17) }).success, false);
  assert.equal(parse({ sermonExperience: "LAINNYA", sermonExperienceOther: "x".repeat(201) }).success, false);
});

test("maskNik sesuai spesifikasi AC/privacy", () => {
  assert.equal(maskNik("3576014241026002"), "3576********6002");
  assert.equal(maskNik("3576014241026002").length, 16);
});

test("loginSchema", () => {
  assert.ok(loginSchema.safeParse({ username: " admin ", password: "x" }).success);
  assert.equal(loginSchema.parse({ username: " admin ", password: "x" }).username, "admin");
  for (const bad of [{}, { username: "", password: "x" }, { username: "a", password: "" }, { username: 1, password: "x" }]) {
    assert.equal(loginSchema.safeParse(bad).success, false);
  }
});

test("rateLimit: batas, retryAfter, key terpisah", () => {
  resetRateLimit();
  for (let i = 0; i < 5; i++) assert.equal(rateLimit("k", 5, 60_000).allowed, true);
  const blocked = rateLimit("k", 5, 60_000);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfter > 0 && blocked.retryAfter <= 60);
  assert.equal(rateLimit("lain", 5, 60_000).allowed, true);
});
