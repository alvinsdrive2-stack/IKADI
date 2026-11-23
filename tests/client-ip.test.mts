// Kunci rate limit tidak boleh bisa dipilih oleh pemanggil.
// X-Real-IP di-set nginx dari $remote_addr; X-Forwarded-For ditambahkan nginx,
// jadi elemen pertamanya berasal dari klien.
// Run: npm run verify:qa
import assert from "node:assert/strict";
import test from "node:test";

const { clientIp } = await import("../lib/http.ts");

const req = (headers: Record<string, string>) =>
  new Request("http://test/api/anggota/login", { headers });

test("memakai X-Real-IP dari proxy, bukan XFF kiriman klien", () => {
  // Kasus nyata: klien mengirim XFF sendiri, nginx menambahkan IP aslinya.
  const ip = clientIp(
    req({
      "x-real-ip": "103.172.204.12",
      "x-forwarded-for": "1.2.3.4, 103.172.204.12",
    }),
  );
  assert.equal(ip, "103.172.204.12");
});

test("XFF saja tetap dipakai kalau X-Real-IP tidak ada", () => {
  assert.equal(clientIp(req({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" })), "1.2.3.4");
});

test("tanpa header apa pun -> unknown, bukan string kosong", () => {
  assert.equal(clientIp(req({})), "unknown");
});

test("X-Real-IP kosong diabaikan, jatuh ke XFF", () => {
  assert.equal(clientIp(req({ "x-real-ip": "   ", "x-forwarded-for": "9.9.9.9" })), "9.9.9.9");
});
