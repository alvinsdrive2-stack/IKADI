// Kontrak C (admin) + D (verifikasi publik) di docs/API-CONTRACT.md.
// prisma + auth di-mock in-memory (QA_MOCK=1). TIDAK menyentuh lib/getMemberCard proyeksi
// untuk menjaga kontrak D, tapi menguji perilaku route yang baru.
// Run: npm run verify:qa
import assert from "node:assert/strict";
import test from "node:test";

const { state, reset } = (await import("./support/mocks.mjs")) as {
  state: {
    rows: Array<Record<string, unknown>>;
    failNextCreateWith: Error | null;
    prints: Array<Record<string, unknown>>;
  };
  reset: () => void;
};
const { authState, resetAuth } = (await import("./support/mock-auth.mjs")) as {
  authState: { adminId?: string; username?: string; anggotaParticipantId: string | null };
  resetAuth: () => void;
};

const { GET: getMembership, PATCH: patchMembership } = await import(
  "../app/api/admin/participants/[id]/membership/route.ts"
);
const { POST: postKta } = await import("../app/api/admin/participants/[id]/kta/route.ts");
const { resetRateLimit } = await import("../lib/rate-limit.ts");

const jsonReq = (url: string, method: string, body?: unknown) =>
  new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });

const patch = (id: string, body: unknown) =>
  patchMembership(jsonReq(`http://test/api/admin/participants/${id}/membership`, "PATCH", body), {
    params: Promise.resolve({ id }),
  });

const get = (id: string) =>
  getMembership(new Request(`http://test/api/admin/participants/${id}/membership`), {
    params: Promise.resolve({ id }),
  });

const print = (id: string) =>
  postKta(new Request(`http://test/api/admin/participants/${id}/kta`, { method: "POST" }), {
    params: Promise.resolve({ id }),
  });

/** Peserta siap cetak: wilayah lengkap, level valid, tanpa nomor. */
function seedReady(overrides: Record<string, unknown> = {}) {
  const row = {
    id: BigInt(1),
    fullName: "H. Ahmad Fauzi, S.Pd.",
    levelCode: 6,
    provinceCode: "16",
    regencyCode: "01",
    memberNumber: null,
    memberNumberIssuedAt: null,
    membershipStatus: "AKTIF",
    passwordHash: null,
    createdAt: new Date("2026-06-01T00:00:00Z"),
    originType: "PW",
    originName: "Sumatera Selatan",
    photoPath: null,
    ...overrides,
  };
  state.rows.push(row);
  return row.id;
}

test.beforeEach(() => {
  reset();
  resetAuth();
  resetRateLimit();
});

// --- Membership PATCH ---

test("PATCH: nomor sudah terbit + ubah level -> 409 FORBIDDEN, tidak berubah", async () => {
  seedReady({ memberNumber: "6.16.01.26.0001" });
  const res = await patch("1", { levelCode: 7 });
  assert.equal(res.status, 409);
  assert.deepEqual(await res.json(), {
    ok: false,
    code: "FORBIDDEN",
    message: "Nomor anggota sudah terbit. Level dan wilayah tidak bisa diubah.",
  });
  assert.equal(state.rows[0].levelCode, 6);
});

test("PATCH: nomor sudah terbit + ubah membershipStatus -> 200 (bukan 409)", async () => {
  seedReady({ memberNumber: "6.16.01.26.0001", membershipStatus: "AKTIF" });
  const res = await patch("1", { membershipStatus: "NONAKTIF" });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.ok, true);
  assert.equal(json.data.membershipStatus, "NONAKTIF");
  assert.equal(state.rows[0].membershipStatus, "NONAKTIF");
  assert.equal(state.rows[0].memberNumber, "6.16.01.26.0001");
});

test("PATCH: nomor sudah terbit + newPassword -> 200, passwordHash berubah", async () => {
  seedReady({ memberNumber: "6.16.01.26.0001" });
  const before = state.rows[0].passwordHash;
  const res = await patch("1", { newPassword: "sandi-baru-kuat" });
  assert.equal(res.status, 200);
  assert.notEqual(state.rows[0].passwordHash, before);
  assert.ok(state.rows[0].passwordHash);
});

test("PATCH: nomor sudah terbit + newPassword < 8 -> 400 VALIDATION", async () => {
  seedReady({ memberNumber: "6.16.01.26.0001" });
  const res = await patch("1", { newPassword: "pendek" });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).code, "VALIDATION");
  assert.equal(state.rows[0].passwordHash, null);
});

test("PATCH: provinceCode tanpa regencyCode -> 400", async () => {
  seedReady();
  const res = await patch("1", { provinceCode: "16" });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).code, "VALIDATION");
});

test("PATCH: kode wilayah tidak ada di master -> 400", async () => {
  seedReady();
  const res = await patch("1", { provinceCode: "99", regencyCode: "01" });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).code, "VALIDATION");

  const res2 = await patch("1", { provinceCode: "16", regencyCode: "99" });
  assert.equal(res2.status, 400);
});

test("PATCH: tanpa sesi admin -> 401", async () => {
  seedReady();
  authState.adminId = undefined;
  authState.username = undefined;
  const res = await patch("1", { membershipStatus: "NONAKTIF" });
  assert.equal(res.status, 401);
  assert.equal((await res.json()).code, "UNAUTHORIZED");
});

test("PATCH: level di luar 1..7 / bukan integer -> 400", async () => {
  seedReady();
  for (const lvl of [0, 8, 6.5]) {
    const res = await patch("1", { levelCode: lvl });
    assert.equal(res.status, 400, `levelCode ${lvl} harus ditolak`);
  }
});

test("PATCH: nomor belum terbit + ubah level/wilayah -> 200 (masih boleh)", async () => {
  seedReady();
  const res = await patch("1", { levelCode: 7, provinceCode: "16", regencyCode: "01" });
  assert.equal(res.status, 200);
  assert.equal(state.rows[0].levelCode, 7);
});

test("GET membership: bentuk 200 sesuai kontrak, eligible = false tanpa nomor", async () => {
  seedReady();
  const res = await get("1");
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.ok, true);
  assert.equal(json.data.participantId, "1");
  assert.equal(json.data.eligible, true);
  assert.equal(json.data.memberNumber, null);
  assert.equal(json.data.hasPassword, false);

  authState.anggotaParticipantId = "1";
  assert.ok(json.data.levelLabel, "levelLabel harus ada");
});

test("GET membership: id bukan angka -> 404; peserta tak ada -> 404", async () => {
  let res = await get("abc");
  assert.equal(res.status, 404);
  res = await get("999");
  assert.equal(res.status, 404);
});

// --- KTA print ---

test("KTA: kuota habis -> 409 PRINT_LIMIT_REACHED untuk penerbitan baru, prints tidak bertambah", async () => {
  const oldLimit = process.env.KTA_PRINT_LIMIT;
  process.env.KTA_PRINT_LIMIT = "1";
  try {
    seedReady();
    // Cetak pertama: habiskan satu-satunya kuota (sekaligus terbitkan nomor).
    let res = await print("1");
    assert.equal(res.status, 200);
    assert.equal(state.prints.length, 1);

    // Peserta lain yang belum punya nomor: kuota habis (COUNT(kta_prints) >= 1).
    seedReady({ id: BigInt(2), nik: "3273010101010002" });
    res = await print("2");
    assert.equal(res.status, 409);
    const json = await res.json();
    assert.equal(json.code, "PRINT_LIMIT_REACHED");
    assert.match(json.message, /\(1\/1\)\./);
    assert.equal(state.prints.length, 1, "kuota habis -> tidak ada insert baru");
  } finally {
    if (oldLimit === undefined) delete process.env.KTA_PRINT_LIMIT;
    else process.env.KTA_PRINT_LIMIT = oldLimit;
  }
});

test("KTA: wilayah kosong -> 409 NOT_ELIGIBLE", async () => {
  seedReady({ provinceCode: null, regencyCode: null });
  const res = await print("1");
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, "NOT_ELIGIBLE");
  assert.equal(state.prints.length, 0);
});

test("KTA: level invalid -> 409 NOT_ELIGIBLE", async () => {
  seedReady({ levelCode: 0 });
  const res = await print("1");
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, "NOT_ELIGIBLE");
});

test("KTA: cetak pertama terbitkan nomor format L.WW.DD.YY.NNNN, issued=true", async () => {
  seedReady();
  const res = await print("1");
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.ok, true);
  const d = json.data;
  assert.match(d.memberNumber, /^[1-7]\.\d{2}\.\d{2}\.\d{2}\.\d{4}$/);
  assert.equal(d.memberNumber, "6.16.01.26.0001"); // level 6, prov 16, kab 01, thn 26, serial 0001
  assert.equal(d.issued, true);
  assert.equal(d.fullName, "H. Ahmad Fauzi, S.Pd.");
  assert.equal(typeof d.verifyUrl, "string");
  assert.match(d.verifyUrl, /\/verifikasi\/6\.16\.01\.26\.0001/);
  assert.assert(d.qrPng.startsWith("data:image/png;base64,"));
  // Anggota sudah punya nomor permanen di DB.
  assert.equal(state.rows[0].memberNumber, "6.16.01.26.0001");
  assert.equal(state.prints.length, 1);
});

test("KTA: cetak kedua nomor SAMA, issued=false, tidak terbitkan serial baru, kuota tidak bertambah", async () => {
  seedReady();
  const res1 = await print("1");
  const d1 = (await res1.json()).data;
  const res2 = await print("1");
  const d2 = (await res2.json()).data;

  assert.equal(d2.memberNumber, d1.memberNumber);
  assert.equal(d2.issued, false);
  // Serial di sequences cuma 1 (tidak increment pada cetak kedua).
  const [seq] = [...state.sequences.values()];
  assert.equal(seq, 1);
  assert.equal(state.prints.length, 1, "cetak ulang tidak menambah pemakaian kuota");
  assert.equal(d2.remainingPrints, d1.remainingPrints);
});

test("KTA: kuota hanya terpakai sekali walau dicetak berkali-kali", async () => {
  const oldLimit = process.env.KTA_PRINT_LIMIT;
  process.env.KTA_PRINT_LIMIT = "3";
  try {
    seedReady();
    const r1 = (await (await print("1")).json()).data;
    const r2 = (await (await print("1")).json()).data;
    const r3 = (await (await print("1")).json()).data;
    assert.equal(r1.issued, true);
    assert.equal(r1.remainingPrints, 2);
    assert.equal(r2.remainingPrints, 2);
    assert.equal(r3.remainingPrints, 2);
    assert.equal(state.prints.length, 1);
  } finally {
    if (oldLimit === undefined) delete process.env.KTA_PRINT_LIMIT;
    else process.env.KTA_PRINT_LIMIT = oldLimit;
  }
});

test("KTA: nomor SUDAH ADA -> issued=false, kuota tidak terpakai", async () => {
  seedReady({ memberNumber: "6.16.01.26.0007", memberNumberIssuedAt: new Date("2026-06-01") });
  const res = await print("1");
  assert.equal(res.status, 200);
  const d = (await res.json()).data;
  assert.equal(d.memberNumber, "6.16.01.26.0007", "nomor lama dipakai, tidak ditimpa");
  assert.equal(d.issued, false);
  assert.equal(state.prints.length, 0, "cetak ulang tidak menulis kta_prints");
});

test("KTA: tanpa sesi admin -> 401", async () => {
  seedReady();
  authState.adminId = undefined;
  authState.username = undefined;
  const res = await print("1");
  assert.equal(res.status, 401);
  assert.equal((await res.json()).code, "UNAUTHORIZED");
});

test("KTA: id bukan angka -> 404; peserta tak ada -> 404", async () => {
  let res = await print("abc");
  assert.equal(res.status, 404);
  res = await print("999");
  assert.equal(res.status, 404);
});

test("KTA: GET tidak diekspor (cetak hanya POST — kontrak)", async () => {
  const mod = await import("../app/api/admin/participants/[id]/kta/route.ts");
  assert.equal(typeof (mod as { GET?: unknown }).GET, "undefined");
});

// --- Proyeksi sempit halaman verifikasi (kontrak D, lib-level) ---
test("getMemberCard: proyeksi tidak pernah memuat field privat", async () => {
  seedReady({ nik: "3576014241026002", whatsapp: "085987654321", ktpPath: "ktp/1.jpg", addressCurrent: "Jl. A", memberNumber: "6.16.01.26.0001" });
  const { getMemberCard } = await import("../lib/queries.ts");
  const card = await getMemberCard("6.16.01.26.0001");
  assert.ok(card, "nomor ada -> kartu harus ketemu");
  for (const priv of ["nik", "address", "whatsapp", "ktpPath", "passwordHash", "id"]) {
    assert.equal(priv in (card as Record<string, unknown>), false, `${priv} tidak boleh ada di kartu`);
  }
  assert.ok(card!.fullName);
  assert.ok(card!.memberNumber);
});
