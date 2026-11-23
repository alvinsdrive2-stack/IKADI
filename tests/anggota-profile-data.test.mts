// Anggota menyunting datanya sendiri: NIK dan wilayah tidak boleh ikut berubah,
// dan sesi orang lain tidak bisa dipakai untuk menyunting milik siapa pun.
// prisma + auth di-mock (QA_MOCK=1).
// Run: npm run verify:qa
import assert from "node:assert/strict";
import test from "node:test";

const { state, reset } = (await import("./support/mocks.mjs")) as {
  state: { rows: Array<Record<string, unknown>> };
  reset: () => void;
};
const { authState, resetAuth } = (await import("./support/mock-auth.mjs")) as {
  authState: { anggotaParticipantId: string | null };
  resetAuth: () => void;
};
const { PATCH, GET } = await import("../app/api/anggota/profil/data/route.ts");
const { resetRateLimit } = await import("../lib/rate-limit.ts");

const req = (method: string, body?: unknown) =>
  new Request("http://test/api/anggota/profil/data", {
    method,
    headers: { "content-type": "application/json", "x-forwarded-for": "10.6.1.1" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const patch = (body: unknown) => PATCH(req("PATCH", body));

const base = {
  fullName: "H. Ahmad Fauzi, S.Pd.",
  whatsapp: "08125323852",
  birthPlace: "Surabaya",
  birthDate: "1980-05-17",
  gender: "LAKI_LAKI",
  maritalStatus: "SUDAH_MENIKAH",
  bloodType: "O",
  addressKtp: "Desa Sukamaju, Kec. Taman, Sidoarjo",
  addressSameAsKtp: true,
  occupation: "Guru",
};

const seed = () => {
  const row = {
    id: BigInt(1),
    nik: "3576014241026002",
    fullName: "LAMA",
    birthDate: new Date("1980-05-17T00:00:00Z"),
    provinceCode: "16",
    regencyCode: "01",
    levelCode: 6,
  };
  state.rows.push(row);
  return row;
};

test.beforeEach(() => {
  reset();
  resetAuth();
  resetRateLimit();
  authState.anggotaParticipantId = "1";
});

test("401 tanpa sesi anggota", async () => {
  authState.anggotaParticipantId = null;
  seed();
  const res = await patch(base);
  assert.equal(res.status, 401);
});

test("200: data pribadi tersimpan", async () => {
  const row = seed();
  const res = await patch(base);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, data: { updated: true } });
  assert.equal(row.fullName, "H. Ahmad Fauzi, S.Pd.");
  assert.equal(row.address, base.addressKtp);
});

test("NIK, wilayah, dan level tidak bisa diubah dari jalur ini", async () => {
  const row = seed();
  const res = await patch({
    ...base,
    nik: "3576014241026099",
    provinceCode: "31",
    regencyCode: "71",
    levelCode: 1,
  });
  assert.equal(res.status, 200);
  // Skema membuang field yang tidak dikenal.
  assert.equal(row.nik, "3576014241026002");
  assert.equal(row.provinceCode, "16");
  assert.equal(row.regencyCode, "01");
  assert.equal(row.levelCode, 6);
});

test("400 kalau isian wajib kosong atau WhatsApp tidak valid", async () => {
  seed();
  for (const body of [
    { ...base, fullName: "" },
    { ...base, occupation: "  " },
    { ...base, whatsapp: "abc" },
  ]) {
    const res = await patch(body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.equal((await res.json()).code, "VALIDATION");
  }
});

test("GET hanya mengembalikan data milik sendiri, tanpa NIK", async () => {
  seed();
  state.rows.push({ id: BigInt(2), nik: "3576014241026099", fullName: "ORANG LAIN" });
  const res = await GET();
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.birthDate, "1980-05-17");
  assert.equal("nik" in body.data, false);
  assert.equal(body.data.fullName, "LAMA");
});
