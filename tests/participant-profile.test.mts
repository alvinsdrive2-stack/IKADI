// Suntingan data pribadi oleh admin: validasi boundary + hasil tulis.
// prisma di-mock in-memory (QA_MOCK=1).
// Run: npm run verify:qa
import assert from "node:assert/strict";
import test from "node:test";

const { state, reset } = (await import("./support/mocks.mjs")) as {
  state: { rows: Array<Record<string, unknown>> };
  reset: () => void;
};
const { authState, resetAuth } = (await import("./support/mock-auth.mjs")) as {
  authState: { adminId?: string; anggotaParticipantId: string | null };
  resetAuth: () => void;
};
const { PATCH } = await import("../app/api/admin/participants/[id]/route.ts");
const { resetRateLimit } = await import("../lib/rate-limit.ts");

let ip = 0;
const patch = (id: string, body: unknown) =>
  PATCH(
    new Request(`http://test/api/admin/participants/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-forwarded-for": `10.7.${++ip}.1` },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );

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
  const row = { id: BigInt(1), nik: "3576014241026002", fullName: "LAMA", address: "" };
  state.rows.push(row);
  return row;
};

test.beforeEach(() => {
  reset();
  resetAuth();
  resetRateLimit();
  authState.anggotaParticipantId = null;
});

test("401 tanpa sesi admin", async () => {
  authState.adminId = undefined;
  const res = await patch("1", base);
  assert.equal(res.status, 401);
});

test("200: data tersimpan, address lama dicerminkan dari alamat KTP", async () => {
  const row = seed();
  const res = await patch("1", base);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, data: { id: "1" } });
  assert.equal(row.fullName, "H. Ahmad Fauzi, S.Pd.");
  assert.equal(row.whatsapp, "08125323852");
  assert.equal(row.addressKtp, base.addressKtp);
  assert.equal(row.address, base.addressKtp);
  assert.equal(row.addressCurrent, base.addressKtp);
  assert.equal(row.occupation, "Guru");
  assert.equal(row.mustChangePassword, undefined);
});

test("alamat tinggal beda dari KTP dipakai apa adanya", async () => {
  const row = seed();
  const res = await patch("1", {
    ...base,
    addressSameAsKtp: false,
    addressCurrent: "Jl. Merdeka 1, Jakarta",
  });
  assert.equal(res.status, 200);
  assert.equal(row.addressCurrent, "Jl. Merdeka 1, Jakarta");
  assert.equal(row.address, "Jl. Merdeka 1, Jakarta");
  assert.equal(row.addressKtp, base.addressKtp);
});

test("400 kalau nama kosong / WhatsApp tidak valid / tanggal di masa depan", async () => {
  seed();
  for (const body of [
    { ...base, fullName: "   " },
    { ...base, whatsapp: "12345" },
    { ...base, birthDate: "2999-01-01" },
    { ...base, birthDate: "17-05-1980" },
  ]) {
    const res = await patch("1", body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.equal((await res.json()).code, "VALIDATION");
  }
});

test("400 body bukan JSON", async () => {
  seed();
  const res = await patch("1", "{bukan json");
  assert.equal(res.status, 400);
});

test("404 kalau peserta tidak ada", async () => {
  const res = await patch("999", base);
  assert.equal(res.status, 404);
  assert.equal((await res.json()).code, "NOT_FOUND");
});
