// Gerbang area anggota: satu kewajiban tidak boleh melempar ke kewajiban lain.
// Regresi yang dijaga: dua halaman (lengkapi profil & ganti sandi) tampil
// bersamaan lalu saling tumpang tindih.
// Run: npm run verify:qa
import assert from "node:assert/strict";
import test from "node:test";

const { resolveAnggotaGate } = await import("../lib/anggota-gate.ts");

const gate = (needsProfileCompletion: boolean, mustChangePassword: boolean, pathname: string) =>
  resolveAnggotaGate({ needsProfileCompletion, mustChangePassword, pathname });

test("tanpa kewajiban: tidak ada redirect", () => {
  assert.equal(gate(false, false, "/anggota"), null);
});

test("hanya profil belum lengkap", () => {
  assert.equal(gate(true, false, "/anggota"), "/anggota/lengkapi");
  assert.equal(gate(true, false, "/anggota/lengkapi"), null);
});

test("hanya sandi wajib diganti", () => {
  assert.equal(gate(false, true, "/anggota"), "/anggota/ganti-sandi");
  assert.equal(gate(false, true, "/anggota/ganti-sandi"), null);
});

// Ini kasus yang dulu bikin dua halaman tampil bersamaan.
test("keduanya aktif: profil menang, ganti-sandi tidak dilempar balik", () => {
  assert.equal(gate(true, true, "/anggota"), "/anggota/lengkapi");
  assert.equal(gate(true, true, "/anggota/ganti-sandi"), "/anggota/lengkapi");
  assert.equal(gate(true, true, "/anggota/lengkapi"), null);
});

test("setelah profil selesai, kewajiban sandi tetap berlaku", () => {
  // needsProfileCompletion=false, mustChangePassword=true.
  assert.equal(gate(false, true, "/anggota/lengkapi"), "/anggota/ganti-sandi");
});

test("halaman anak ikut dianggap halaman yang sama", () => {
  assert.equal(gate(true, true, "/anggota/lengkapi/apa-saja"), null);
  assert.equal(gate(false, true, "/anggota/ganti-sandi?x=1"), null);
});
