// Parser filter daftar peserta. Nilai aneh harus diabaikan, bukan bikin 500:
// filter yang salah ketik tidak boleh menyembunyikan seluruh daftar.
// Run: npm run verify:qa
import assert from "node:assert/strict";
import test from "node:test";

const { ktaParam, levelParam, sourceParam } = await import("../lib/participants-filter.ts");

const sp = (qs: string) => new URLSearchParams(qs);

test("kta: hanya terbit/menunggu yang diterima", () => {
  assert.equal(ktaParam(sp("kta=terbit")), "terbit");
  assert.equal(ktaParam(sp("kta=menunggu")), "menunggu");
  assert.equal(ktaParam(sp("kta=")), undefined);
  assert.equal(ktaParam(sp("")), undefined);
  assert.equal(ktaParam(sp("kta=apa-saja")), undefined);
  assert.equal(ktaParam(sp("kta=TERBIT")), undefined);
});

test("level: di luar 1..7 diabaikan", () => {
  assert.equal(levelParam(sp("level=2")), 2);
  assert.equal(levelParam(sp("level=7")), 7);
  assert.equal(levelParam(sp("level=0")), undefined);
  assert.equal(levelParam(sp("level=8")), undefined);
  assert.equal(levelParam(sp("level=dua")), undefined);
  assert.equal(levelParam(sp("")), undefined);
});

test("source: mandiri atau id angka", () => {
  assert.equal(sourceParam(sp("source=mandiri")), "mandiri");
  assert.equal(sourceParam(sp("source=1")), "1");
  assert.equal(sourceParam(sp("source=abc")), undefined);
  assert.equal(sourceParam(sp("source=")), undefined);
  assert.equal(sourceParam(sp("")), undefined);
});
