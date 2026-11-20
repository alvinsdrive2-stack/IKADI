// Ganti sandi anggota + gerbang wajib ganti sandi.
// prisma + auth di-mock in-memory (QA_MOCK=1). `@/lib/password` asli (argon2 murni).
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
const { hashPassword } = await import("../lib/password.ts");

const { POST: postSandi } = await import("../app/api/anggota/sandi/route.ts");
const { POST: postLengkapi } = await import("../app/api/anggota/profil/lengkapi/route.ts");
const { resetRateLimit } = await import("../lib/rate-limit.ts");

let ip = 0;
const req = (url: string, body?: unknown) =>
  new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `10.9.${++ip}.1` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const changePassword = (body: unknown) =>
  postSandi(req("http://test/api/anggota/sandi", body));

const seed = async (hash: string | null) => {
  const row = {
    id: BigInt(1),
    fullName: "H. Ahmad Fauzi, S.Pd.",
    nik: "3576014241026002",
    passwordHash: hash,
    mustChangePassword: true,
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

test("sandi sementara seragam IcardIkadi", async () => {
  const { TEMP_PASSWORD } = await import("../lib/munas-password.ts");
  assert.equal(TEMP_PASSWORD, "IcardIkadi");
});

test("401 tanpa sesi anggota", async () => {
  authState.anggotaParticipantId = null;
  const res = await changePassword({ currentPassword: "060304", password: "sandiBaru123" });
  assert.equal(res.status, 401);
});

test("400 kalau sandi lama salah, sandi tidak berubah", async () => {
  const row = await seed(await hashPassword("060304"));
  const res = await changePassword({ currentPassword: "salah", password: "sandiBaru123" });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.code, "VALIDATION");
  assert.equal(body.errors.currentPassword, "Sandi saat ini salah.");
  assert.equal(row.mustChangePassword, true);
  assert.equal(await (await import("../lib/password.ts")).verifyPassword(
    row.passwordHash as string,
    "060304",
  ), true);
});

test("400 kalau sandi baru sama dengan sandi lama", async () => {
  await seed(await hashPassword("060304"));
  const res = await changePassword({ currentPassword: "060304", password: "060304" });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).code, "VALIDATION");
});

test("400 kalau sandi baru kurang dari 8 karakter", async () => {
  await seed(await hashPassword("060304"));
  const res = await changePassword({ currentPassword: "060304", password: "1234567" });
  assert.equal(res.status, 400);
});

test("sukses: hash diganti, mustChangePassword dimatikan", async () => {
  const row = await seed(await hashPassword("060304"));
  const res = await changePassword({ currentPassword: "060304", password: "sandiBaru123" });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, data: { changed: true } });
  assert.equal(row.mustChangePassword, false);
  const { verifyPassword } = await import("../lib/password.ts");
  assert.equal(await verifyPassword(row.passwordHash as string, "sandiBaru123"), true);
  assert.equal(await verifyPassword(row.passwordHash as string, "060304"), false);
});

test("409 kalau akun belum punya sandi sama sekali", async () => {
  await seed(null);
  const res = await changePassword({ currentPassword: "060304", password: "sandiBaru123" });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, "NO_PASSWORD");
});

test("lengkapi profil juga mematikan mustChangePassword", async () => {
  const row = await seed(await hashPassword("060304"));
  Object.assign(row, { needsProfileCompletion: true });
  const res = await postLengkapi(
    req("http://test/api/anggota/profil/lengkapi", {
      birthPlace: "Surabaya",
      addressKtp: "Desa Sukamaju, Kec. Taman, Sidoarjo",
      addressSameAsKtp: true,
      occupation: "Guru",
      password: "sandiBaru123",
    }),
  );
  assert.equal(res.status, 200);
  assert.equal(row.mustChangePassword, false);
  assert.equal(row.needsProfileCompletion, false);
});
