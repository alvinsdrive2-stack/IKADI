// Kontrak A (Auth anggota) di docs/API-CONTRACT.md, level route. No MySQL:
// prisma + auth di-mock in-memory (QA_MOCK=1). `@/lib/password` asli (argon2 murni).
// Run: npm run verify:qa
import assert from "node:assert/strict";
import test from "node:test";

const { state, reset } = (await import("./support/mocks.mjs")) as {
  state: { rows: Array<Record<string, unknown>>; failNextCreateWith: Error | null };
  reset: () => void;
};
const { authState, resetAuth } = (await import("./support/mock-auth.mjs")) as {
  authState: { adminId?: string; username?: string; anggotaParticipantId: string | null };
  resetAuth: () => void;
};
const { hashPassword } = await import("../lib/password.ts");

const { POST: postLogin } = await import("../app/api/anggota/login/route.ts");
const { POST: postLogout } = await import("../app/api/anggota/logout/route.ts");
const { GET: getMe } = await import("../app/api/anggota/me/route.ts");
const { resetRateLimit } = await import("../lib/rate-limit.ts");

const req = (method: string, body?: unknown, headers: Record<string, string> = {}, ip = 1) =>
  new Request("http://test/api/anggota/login", {
    method,
    headers: { "content-type": "application/json", "x-forwarded-for": `10.2.${ip}.1`, ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });

const login = (body: unknown, ip = 1) => postLogin(req("POST", body, {}, ip));

const participantRow = {
  id: BigInt(1),
  fullName: "H. Ahmad Fauzi, S.Pd.",
  nik: "3576014241026002",
  memberNumber: "6.16.01.26.0001",
  levelCode: 6,
  originType: "PW",
  originName: "Sumatera Selatan",
  passwordHash: null as string | null,
};

function seedParticipant(hash: string | null) {
  participantRow.passwordHash = hash;
  state.rows.push({ ...participantRow });
}

test.beforeEach(() => {
  reset();
  resetAuth();
  resetRateLimit();
});

// --- Pesan seragam: anti-enumerasi akun (kontrak A, 401) ---
test("401 pesan IDENTIK untuk: NIK tidak terdaftar / passwordHash null / sandi salah", async () => {
  // 1) NIK tidak terdaftar
  const resNoNik = await login({ nik: "3576014241026099", password: "sandi-apa-aja" });
  assert.equal(resNoNik.status, 401);
  const a = await resNoNik.json();

  // 2) Terdaftar tapi belum pernah set sandi
  seedParticipant(null);
  const resNoHash = await login({ nik: "3576014241026002", password: "sandi-apa-aja" });
  assert.equal(resNoHash.status, 401);
  const b = await resNoHash.json();

  // 3) Terdaftar + punya sandi, tapi sandi salah
  reset();
  seedParticipant(await hashPassword("sandi-bener"));
  const resWrong = await login({ nik: "3576014241026002", password: "sandi-salah" });
  assert.equal(resWrong.status, 401);
  const c = await resWrong.json();

  assert.deepEqual(a, { ok: false, code: "UNAUTHORIZED", message: "NIK atau sandi salah." });
  assert.deepEqual(b, { ok: false, code: "UNAUTHORIZED", message: "NIK atau sandi salah." });
  assert.deepEqual(c, { ok: false, code: "UNAUTHORIZED", message: "NIK atau sandi salah." });
  // Sesi tidak boleh terbentuk di ketiga kasus.
  assert.equal(authState.anggotaParticipantId, null);
});

test("400 VALIDATION: NIK bukan 16 digit / sandi kosong / bukan string", async () => {
  for (const body of [
    { nik: "35760142410260", password: "x" },
    { nik: "35760142410260021", password: "x" },
    { nik: "35760142410260X2", password: "x" },
    { nik: "3576014241026002", password: "" },
    { nik: "3576014241026002" },
    { password: "x" },
    { nik: 3576014241026002, password: "x" },
  ]) {
    const res = await login(body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.equal((await res.json()).code, "VALIDATION");
  }
  assert.equal(state.rows.length, 0);
});

test("429: percobaan ke-6 dari IP sama dalam 10 menit", async () => {
  const ip = 7;
  // IP sama, NIK beda-beda: rate limit per IP, bukan per akun.
  for (let i = 0; i < 5; i++) {
    await login({ nik: `35760142410260${String(i).padStart(2, "0")}`, password: "x" }, ip);
  }
  const res = await login({ nik: "3576014241026002", password: "x" }, ip);
  assert.equal(res.status, 429);
  assert.equal((await res.json()).code, "RATE_LIMIT");
  assert.ok(Number(res.headers.get("retry-after")) > 0);
  // IP beda tidak ikut kena.
  assert.equal((await login({ nik: "3576014241026002", password: "x" }, 8)).status, 401);
});

test("sukses -> 200, payload sesuai kontrak, sesi anggota terbentuk", async () => {
  seedParticipant(await hashPassword("sandi-bener"));
  const res = await login({ nik: "3576014241026002", password: "sandi-bener" });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.ok, true);
  // Kontrak A: persis lima field ini.
  assert.deepEqual(Object.keys(json.data).sort(), ["fullName", "levelCode", "memberNumber", "originName", "originType"]);
  assert.equal(json.data.fullName, "H. Ahmad Fauzi, S.Pd.");
  assert.equal(json.data.memberNumber, "6.16.01.26.0001");
  assert.equal(json.data.levelCode, 6);
  assert.equal(json.data.originType, "PW");
  // Tidak bocor: passwordHash & NIK tidak di payload.
  assert.equal("passwordHash" in json.data, false);
  assert.equal("nik" in json.data, false);
  assert.equal(authState.anggotaParticipantId, "1");
});

// --- Logout: 200 walau belum login (kontrak A) ---
test("logout -> 200, idempotent, hapus sesi", async () => {
  authState.anggotaParticipantId = "1";
  let res = await postLogout();
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, data: null });
  assert.equal(authState.anggotaParticipantId, null);
  // Tanpa sesi juga 200.
  res = await postLogout();
  assert.equal(res.status, 200);
});
