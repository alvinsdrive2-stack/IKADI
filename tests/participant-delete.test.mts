// Hapus peserta: hanya admin, transaksi bersih, berkas ikut dihapus.
// prisma + auth + photo di-mock (QA_MOCK=1).
// Run: npm run verify:qa
import assert from "node:assert/strict";
import test from "node:test";

const { state, reset } = (await import("./support/mocks.mjs")) as {
  state: { rows: Array<Record<string, unknown>>; prints: Array<Record<string, unknown>> };
  reset: () => void;
};
const { authState, resetAuth } = (await import("./support/mock-auth.mjs")) as {
  authState: { adminId?: string };
  resetAuth: () => void;
};
const { deleted, failNext } = (await import("./support/mock-photo.mjs")) as {
  deleted: { photo: string[]; ktp: string[] };
  failNext: { value: boolean };
};
const resetPhotoCalls = () => {
  deleted.photo = [];
  deleted.ktp = [];
  failNext.value = false;
};
const { DELETE } = await import("../app/api/admin/participants/[id]/route.ts");
const { resetRateLimit } = await import("../lib/rate-limit.ts");

const del = (id: string) =>
  DELETE(new Request(`http://test/api/admin/participants/${id}`, { method: "DELETE" }), {
    params: Promise.resolve({ id }),
  });

const seed = (over: Record<string, unknown> = {}) => {
  const row = {
    id: BigInt(1),
    nik: "3576014241026002",
    fullName: "H. Ahmad Fauzi, S.Pd.",
    photoPath: "uploads/participants/1.jpg",
    ktpPath: "ktp/1.jpg",
    ...over,
  };
  state.rows.push(row);
  return row;
};

test.beforeEach(() => {
  reset();
  resetAuth();
  resetRateLimit();
  resetPhotoCalls();
  authState.adminId = "1";
});

test("401 tanpa sesi admin", async () => {
  authState.adminId = undefined;
  seed();
  const res = await del("1");
  assert.equal(res.status, 401);
  assert.equal(state.rows.length, 1);
});

test("200: baris peserta hilang", async () => {
  seed();
  const res = await del("1");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, data: { id: "1" } });
  assert.equal(state.rows.length, 0);
});

test("riwayat cetak peserta ikut dibersihkan, milik peserta lain tetap", async () => {
  seed();
  state.prints.push(
    { id: BigInt(1), participantId: BigInt(1), memberNumber: "6.16.01.26.00100" },
    { id: BigInt(2), participantId: BigInt(2), memberNumber: "6.16.01.26.00101" },
  );
  const res = await del("1");
  assert.equal(res.status, 200);
  assert.equal(state.prints.length, 1);
  assert.equal(String(state.prints[0].participantId), "2");
});

test("berkas pas foto dan foto KTP ikut dihapus", async () => {
  seed();
  await del("1");
  assert.deepEqual(deleted.photo, ["uploads/participants/1.jpg"]);
  assert.deepEqual(deleted.ktp, ["ktp/1.jpg"]);
});

test("peserta tanpa berkas tidak memanggil penghapusan berkas", async () => {
  seed({ photoPath: null, ktpPath: null });
  await del("1");
  assert.deepEqual(deleted.photo, []);
  assert.deepEqual(deleted.ktp, []);
});

test("404 kalau peserta tidak ada", async () => {
  const res = await del("999");
  assert.equal(res.status, 404);
  assert.equal((await res.json()).code, "NOT_FOUND");
});

test("gagal hapus berkas tidak membatalkan hasil", async () => {
  seed();
  failNext.value = true;
  const res = await del("1");
  assert.equal(res.status, 200);
  assert.equal(state.rows.length, 0);
});
