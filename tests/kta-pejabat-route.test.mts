// CRUD nama pejabat KTA + sinkronisasi ke payload cetak.
// prisma/auth di-mock (QA_MOCK=1). Run: npm run verify:qa
import assert from "node:assert/strict";
import test from "node:test";

const { state, reset } = (await import("./support/mocks.mjs")) as {
  state: { officials: Map<string, unknown> };
  reset: () => void;
};
const { authState, resetAuth } = (await import("./support/mock-auth.mjs")) as {
  authState: { adminId?: string; username?: string; anggotaParticipantId: string | null };
  resetAuth: () => void;
};
const { resetRateLimit } = await import("../lib/rate-limit.ts");
const { GET, PATCH } = await import("../app/api/admin/kta/pejabat/route.ts");
const { getPejabat } = await import("../lib/kta.ts");

const jsonReq = (body?: unknown) =>
  new Request("http://test/api/admin/kta/pejabat", {
    method: body === undefined ? "GET" : "PATCH",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const patch = (body: unknown) => PATCH(jsonReq(body));

test.beforeEach(() => {
  reset();
  resetAuth();
  resetRateLimit();
});

test("GET: tanpa sesi admin -> 401", async () => {
  authState.adminId = undefined;
  authState.username = undefined;
  const res = await GET();
  assert.equal(res.status, 401);
});

test("GET: DB kosong -> fallback env, savedInDb=false", async () => {
  const res = await GET();
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.ok, true);
  assert.equal(json.data.savedInDb, false);
  assert.equal(json.data.ketuaUmum.key, "ketuaUmum");
  assert.equal(json.data.sekjen.key, "sekjen");
  assert.ok(json.data.ketuaUmum.nama.length > 0);
});

test("PATCH: simpan dua pejabat -> 200, tersimpan di DB, nama di-trim", async () => {
  const res = await patch({
    ketuaUmum: { nama: "  Dr. KH. Ahmad Zaini, M.A.  ", jabatan: " Ketua Umum " },
    sekjen: { nama: "H. Abdul Rahman, Lc.", jabatan: "" },
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.data.ketuaUmum.nama, "Dr. KH. Ahmad Zaini, M.A.");
  assert.equal(json.data.sekjen.nama, "H. Abdul Rahman, Lc.");
  // jabatan kosong -> default
  assert.equal(json.data.sekjen.jabatan, "Sekretaris Jenderal");
  assert.equal(json.data.savedInDb, true);
  assert.ok(json.data.updatedAt);
  assert.equal(state.officials.size, 2);
});

test("PATCH: hanya satu kunci -> kunci lain tidak berubah", async () => {
  await patch({ ketuaUmum: { nama: "Ketua A" }, sekjen: { nama: "Sekjen B" } });
  const res = await patch({ sekjen: { nama: "Sekjen C" } });
  const json = await res.json();
  assert.equal(json.data.ketuaUmum.nama, "Ketua A");
  assert.equal(json.data.sekjen.nama, "Sekjen C");
});

test("PATCH: nama kosong -> 400 VALIDATION, tidak menulis apa pun", async () => {
  const res = await patch({ ketuaUmum: { nama: "   " } });
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.equal(json.code, "VALIDATION");
  assert.ok(json.errors["ketuaUmum.nama"]);
  assert.equal(state.officials.size, 0);
});

test("PATCH: body tanpa pejabat -> 400", async () => {
  const res = await patch({});
  assert.equal(res.status, 400);
  assert.equal((await res.json()).code, "VALIDATION");
});

test("PATCH: tanpa sesi admin -> 401", async () => {
  authState.adminId = undefined;
  authState.username = undefined;
  const res = await patch({ ketuaUmum: { nama: "X" } });
  assert.equal(res.status, 401);
});

test("getPejabat: baca DB, bukan env, setelah disimpan", async () => {
  await patch({ ketuaUmum: { nama: "Ketua DB" }, sekjen: { nama: "Sekjen DB" } });
  const p = await getPejabat();
  assert.equal(p.ketuaUmum.nama, "Ketua DB");
  assert.equal(p.sekjen.nama, "Sekjen DB");
});
