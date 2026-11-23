// Ganti sandi admin: sandi lama wajib benar, akun lain tidak tersentuh.
// prisma + auth di-mock (QA_MOCK=1), argon2 asli.
// Run: npm run verify:qa
import assert from "node:assert/strict";
import test from "node:test";

const { state, reset } = (await import("./support/mocks.mjs")) as {
  state: { admins: Array<Record<string, unknown>> };
  reset: () => void;
};
const { authState, resetAuth } = await import("./support/mock-auth.mjs") as unknown as {
  authState: { adminId?: string; username?: string };
  resetAuth: () => void;
};
const { hashPassword, verifyPassword } = await import("../lib/password.ts");
const { POST } = await import("../app/api/admin/sandi/route.ts");
const { GET: getMe } = await import("../app/api/admin/me/route.ts");
const { resetRateLimit } = await import("../lib/rate-limit.ts");

let ip = 0;
const post = (body: unknown) =>
  POST(
    new Request("http://test/api/admin/sandi", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `10.5.${++ip}.1` },
      body: JSON.stringify(body),
    }),
  );

const seedAdmin = async (id: bigint, username: string, plain: string) => {
  const row = { id, username, passwordHash: await hashPassword(plain) };
  state.admins.push(row);
  return row;
};

test.beforeEach(() => {
  reset();
  resetAuth();
  resetRateLimit();
  authState.adminId = "1";
  authState.username = "testadmin";
});

test("401 tanpa sesi admin", async () => {
  authState.adminId = undefined;
  const res = await post({ currentPassword: "lama12345", password: "baru12345" });
  assert.equal(res.status, 401);
});

test("400 kalau sandi lama salah, hash tidak berubah", async () => {
  const admin = await seedAdmin(BigInt(1), "testadmin", "lama12345");
  const before = admin.passwordHash;
  const res = await post({ currentPassword: "salah", password: "baru12345" });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).errors.currentPassword, "Sandi saat ini salah.");
  assert.equal(admin.passwordHash, before);
});

test("400 kalau sandi baru sama dengan sandi lama", async () => {
  await seedAdmin(BigInt(1), "testadmin", "lama12345");
  const res = await post({ currentPassword: "lama12345", password: "lama12345" });
  assert.equal(res.status, 400);
});

test("200: hash diganti, sandi baru berlaku", async () => {
  const admin = await seedAdmin(BigInt(1), "testadmin", "lama12345");
  const res = await post({ currentPassword: "lama12345", password: "baru12345" });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, data: { changed: true } });
  assert.equal(await verifyPassword(admin.passwordHash as string, "baru12345"), true);
  assert.equal(await verifyPassword(admin.passwordHash as string, "lama12345"), false);
});

test("hanya admin di sesi yang berubah, admin lain tidak", async () => {
  const me = await seedAdmin(BigInt(1), "testadmin", "lama12345");
  const other = await seedAdmin(BigInt(2), "lain", "rahasia123");
  const otherHash = other.passwordHash;
  await post({ currentPassword: "lama12345", password: "baru12345" });
  assert.equal(other.passwordHash, otherHash);
  assert.equal(await verifyPassword(me.passwordHash as string, "baru12345"), true);
});

test("GET /api/admin/me: 401 tanpa sesi, identitas tanpa hash", async () => {
  authState.adminId = undefined;
  assert.equal((await getMe()).status, 401);

  authState.adminId = "1";
  authState.username = "testadmin";
  const res = await getMe();
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.data, { id: "1", username: "testadmin" });
});
