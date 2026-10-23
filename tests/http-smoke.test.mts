// AC-09 (and AC-12 on the served HTML) against a running `next start`. No DB needed.
// Start it first, e.g.:
//   DATABASE_URL="mysql://u:p@localhost:3306/ikadi" SESSION_SECRET="0123456789abcdef0123456789abcdef" npx next start -p 3111
//   BASE=http://localhost:3111 npm run verify:qa
// AC-12 empty state dashboard is covered statically in design-sync.test.mts (needs MySQL for live data).
// Without BASE this file skips (reported as skipped, never as passed).
import assert from "node:assert/strict";
import test from "node:test";

const BASE = process.env.BASE;
const skip = BASE ? false : "BASE tidak di-set; jalankan `npx next start` lalu BASE=http://localhost:3111 npm run verify:qa";

const get = (path: string, headers: Record<string, string> = {}) =>
  fetch(`${BASE}${path}`, { redirect: "manual", headers });

test("AC-09: semua API admin menolak tanpa session -> 401", { skip }, async () => {
  for (const p of ["/api/admin/participants", "/api/admin/participants?q=3576", "/api/admin/participants/1", "/api/admin/stats"]) {
    const res = await get(p);
    assert.equal(res.status, 401, `${p} harus 401`);
    assert.equal((await res.json()).code, "UNAUTHORIZED");
  }
});

test("AC-09: cookie palsu tetap ditolak API (cookie-presence bukan otorisasi)", { skip }, async () => {
  const res = await get("/api/admin/stats", { cookie: "ikadi_admin=forged" });
  assert.equal(res.status, 401);
});

test("AC-09: /admin diarahkan ke /admin/login", { skip }, async () => {
  for (const p of ["/admin", "/admin/peserta/1"]) {
    const res = await get(p);
    assert.equal(res.status, 307, `${p} harus redirect`);
    assert.match(res.headers.get("location") ?? "", /\/admin\/login\?next=/);
  }
});

test("AC-09: halaman admin dengan cookie palsu tidak membocorkan dashboard (200 = halaman error, bukan data)", { skip }, async () => {
  // RED: dengan cookie palsu, proxy meloloskan request dan server membalas 200 berisi shell
  // admin ("Dashboard Monitoring"). Assert ini menahan regresi sampai AC-09 diperbaiki.
  const res = await get("/admin", { cookie: "ikadi_admin=forged" });
  const body = await res.text();
  const leaked = /Dashboard Monitoring|Tabel data peserta/.test(body);
  assert.equal(leaked, false, "shell admin bocor ke pengguna tanpa session valid");
});

test("halaman publik bisa diakses", { skip }, async () => {
  for (const p of ["/", "/daftar", "/daftar/sukses", "/admin/login"]) {
    assert.equal((await get(p)).status, 200, `${p} harus 200`);
  }
});

test("POST /api/participants tanpa field wajib -> 400 + errors per field", { skip }, async () => {
  const res = await fetch(`${BASE}/api/participants`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.77" },
    body: "{}",
  });
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.equal(json.code, "VALIDATION");
  assert.ok(json.errors.nik && json.errors.consent);
});
