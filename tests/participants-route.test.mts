// AC-02/03/04/05/06/07/08 at the route level. No MySQL: prisma is mocked in-memory.
// Run: npm run verify:qa
import assert from "node:assert/strict";
import test from "node:test";

// QA_MOCK=1 must already be in the environment: the loader (--import ./tests/support/register-alias.mjs)
// swaps "@/lib/prisma" and "@prisma/client" for ./support/mocks.mjs only from that point on.
const { state, reset } = (await import("./support/mocks.mjs")) as {
  state: { rows: Array<Record<string, unknown>>; failNextCreateWith: Error | null };
  reset: () => void;
};

const { POST } = await import("../app/api/participants/route.ts");
const { resetRateLimit } = await import("../lib/rate-limit.ts");
let ip = 0;
const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new Request("http://test/api/participants", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `10.0.${++ip}.1`, ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

const base = {
  originType: "PW",
  originName: "Jawa Timur",
  fullName: "H. Ahmad Fauzi, S.Pd.",
  nik: "3576014241026002",
  birthPlace: "Surabaya",
  birthDate: "1980-05-17",
  gender: "LAKI_LAKI",
  photo: "data:image/png;base64," + Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]).toString("base64"),
  address: "Desa Sukamaju, Kec. Taman, Sidoarjo, Jawa Timur",
  whatsapp: "085987654321",
  occupation: "Guru",
  sermonExperience: "SERING",
  quranReading: "TAJWID_BAIK",
  trainingReason: "Ingin memperdalam",
  trainingExpectation: "Bisa khutbah",
  consent: true,
};

test.beforeEach(() => {
  reset();
  resetRateLimit();
});

test("AC-02: payload valid -> 201, tepat satu baris", async () => {
  const res = await post(base);
  assert.equal(res.status, 201);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(state.rows.length, 1);
});

test("AC-03: semua field wajib kosong -> 400 + error per field, tidak menyimpan", async () => {
  const required = ["originType", "originName", "fullName", "nik", "birthPlace", "birthDate", "address", "whatsapp", "occupation", "sermonExperience", "quranReading", "trainingReason", "trainingExpectation", "consent"];
  const body: Record<string, unknown> = { ...base };
  for (const k of required) body[k] = "";
  const res = await post(body);
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.equal(json.code, "VALIDATION");
  for (const k of required) assert.ok(json.errors[k], `harus ada error untuk ${k}`);
  assert.equal(state.rows.length, 0);
});

test("AC-03b: satu field wajib hilang (consent false) -> 400", async () => {
  const res = await post({ ...base, consent: false });
  assert.equal(res.status, 400);
  assert.ok((await res.json()).errors.consent);
  assert.equal(state.rows.length, 0);
});

test("AC-04: NIK 15/17 digit atau berkarakter ditolak", async () => {
  const bad = ["357601424102600", "35760142410260021", "35760142410260X2", "3576 0142 4102 6002", "357601424102600.", "+3576014241026002"];
  for (const nik of bad) {
    const res = await post({ ...base, nik });
    assert.equal(res.status, 400, `NIK harus ditolak: ${nik}`);
    assert.ok((await res.json()).errors.nik, `error nik harus ada: ${nik}`);
  }
  assert.equal(state.rows.length, 0);
});

test("AC-05: NIK sama dikirim ulang -> 409 pesan aman, total tidak bertambah", async () => {
  assert.equal((await post(base)).status, 201);
  const res = await post(base);
  assert.equal(res.status, 409);
  assert.deepEqual(await res.json(), {
    ok: false,
    code: "NIK_DUPLICATE",
    message: "NIK ini sudah terdaftar. Silakan hubungi admin jika membutuhkan bantuan.",
  });
  assert.equal(state.rows.length, 1);
});

test("AC-05b: duplikat lewat NIK berkutip tetap 409", async () => {
  assert.equal((await post(base)).status, 201);
  assert.equal((await post({ ...base, nik: `'${base.nik}` })).status, 409);
  assert.equal(state.rows.length, 1);
});

// NOTE: the 409 must come from the unique-constraint branch, not from the findUnique
// pre-check. If the route only relied on the pre-check (which never sees a racing insert),
// these two would return 201/201 or 500 and the assert fails.
test("AC-06: dua request bersamaan NIK sama -> tepat satu tersimpan", async () => {
  const [a, b] = await Promise.all([post(base), post(base)]);
  assert.equal(a.status, 201);
  assert.equal(b.status, 409);
  assert.equal(state.rows.length, 1);
});

// Known gap: node --experimental-transform-types breaks `instanceof <class extends Error>`,
// so this feeds {code:'P2002'} on a plain Error - the shape the real client throws - but
// cannot prove the route matches the real class. Only a real MySQL run can.
test("AC-06b: unique constraint (P2002) dari create -> 409, bukan 500", async () => {
  state.failNextCreateWith = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
  const res = await post(base);
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, "NIK_DUPLICATE");
});

test("AC-07: NIK diawali kutip -> disimpan bersih", async () => {
  const res = await post({ ...base, nik: " '3576014241026002 " });
  assert.equal(res.status, 201);
  assert.equal(state.rows[0].nik, "3576014241026002");
});

test("AC-08: WA diawali 0 / kutip -> tetap string utuh", async () => {
  assert.equal((await post(base)).status, 201);
  assert.equal(state.rows[0].whatsapp, "085987654321");
  assert.equal(typeof state.rows[0].whatsapp, "string");

  assert.equal((await post({ ...base, nik: "3576014241026003", whatsapp: "'085987654321" })).status, 201);
  assert.equal(state.rows[1].whatsapp, "085987654321");

  assert.equal((await post({ ...base, nik: "3576014241026004", whatsapp: "+6285987654321" })).status, 201);
  assert.equal(state.rows[2].whatsapp, "+6285987654321");
});

test("error non-P2002 -> 500, NIK tidak bocor di body maupun log", async () => {
  state.failNextCreateWith = new Error(`boom on ${base.nik}`);
  const logs: string[] = [];
  const orig = console.error;
  console.error = (...a: unknown[]) => {
    logs.push(a.map(String).join(" "));
  };
  let json: { code: string; message: string };
  try {
    const res = await post(base);
    assert.equal(res.status, 500);
    json = await res.json();
  } finally {
    console.error = orig;
  }
  assert.equal(json!.code, "SERVER_ERROR");
  assert.ok(!JSON.stringify(json).includes(base.nik), "NIK tidak boleh ada di response");
  assert.ok(!logs.join("\n").includes(base.nik), "NIK tidak boleh masuk log");
});

test("body bukan JSON -> 400", async () => {
  assert.equal((await post("{not json")).status, 400);
});

test("rate limit: hit ke-6 -> 429 + Retry-After", async () => {
  const ipH = { "x-forwarded-for": "203.0.113.9" };
  for (let i = 0; i < 5; i++) {
    await post({ ...base, nik: `35760142410260${String(i).padStart(2, "0")}` }, ipH);
  }
  const res = await post(base, ipH);
  assert.equal(res.status, 429);
  assert.equal((await res.json()).code, "RATE_LIMIT");
  assert.ok(Number(res.headers.get("retry-after")) > 0);
});
