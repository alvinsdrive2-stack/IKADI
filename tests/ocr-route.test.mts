// Route-level tests untuk POST /api/participants/ocr. No network: "@/lib/ocr"
// is swapped for ./support/mock-ocr.mjs by the alias loader (QA_MOCK=1).
// Run: npm run verify:qa
import assert from "node:assert/strict";
import test from "node:test";

const { ocrState, resetOcr, OcrUnavailableError } = (await import("./support/mock-ocr.mjs")) as {
  ocrState: { failWith: Error | null; result: Record<string, unknown> | null };
  resetOcr: () => void;
  OcrUnavailableError: new (message: string) => Error;
};

const { POST } = await import("../app/api/participants/ocr/route.ts");
const { resetRateLimit } = await import("../lib/rate-limit.ts");

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

let ip = 0;
const post = (body: BodyInit, headers: Record<string, string> = {}) =>
  POST(
    new Request("http://test/api/participants/ocr", {
      method: "POST",
      headers: { "x-forwarded-for": `10.1.${++ip}.1`, ...headers },
      body,
    }),
  );

const postFile = (bytes: Buffer, headers: Record<string, string> = {}) => {
  const form = new FormData();
  form.append("file", new File([new Uint8Array(bytes)], "ktp.png", { type: "image/png" }));
  return post(form, headers);
};

test.beforeEach(() => {
  resetOcr();
  resetRateLimit();
});

test("OCR service mati -> 503 OCR_UNAVAILABLE, bukan 500", async () => {
  ocrState.failWith = new OcrUnavailableError("down");
  const res = await postFile(PNG);
  assert.equal(res.status, 503);
  const json = await res.json();
  assert.equal(json.ok, false);
  assert.equal(json.code, "OCR_UNAVAILABLE");
});

test("sukses -> 200, fields + threshold, confidence 0..1", async () => {
  const res = await postFile(PNG);
  assert.equal(res.status, 200);
  const json = (await res.json()) as {
    ok: boolean;
    threshold: number;
    fields: Record<string, { value: string | null; confidence: number }>;
  };
  assert.equal(json.ok, true);
  assert.equal(typeof json.threshold, "number");
  assert.equal(json.fields.nik.value, "3576014241026002");
  for (const [key, f] of Object.entries(json.fields)) {
    assert.ok(f.confidence >= 0 && f.confidence <= 1, `confidence ${key} di luar 0..1`);
  }
});

test("bytes bukan gambar (magic bytes gagal) -> 400", async () => {
  const res = await postFile(Buffer.from("bukan gambar sama sekali"));
  assert.equal(res.status, 400);
  assert.equal((await res.json()).code, "VALIDATION");
});

test("tanpa field file -> 400", async () => {
  const res = await post(new FormData());
  assert.equal(res.status, 400);
});

test("body bukan multipart -> 400", async () => {
  const res = await post(JSON.stringify({}), { "content-type": "application/json" });
  assert.equal(res.status, 400);
});

test("rate limit: request ke-11 dari IP sama -> 429", async () => {
  const ipH = { "x-forwarded-for": "203.0.113.77" };
  for (let i = 0; i < 10; i++) {
    assert.equal((await postFile(PNG, ipH)).status, 200);
  }
  const res = await postFile(PNG, ipH);
  assert.equal(res.status, 429);
  assert.equal((await res.json()).code, "RATE_LIMIT");
  assert.ok(Number(res.headers.get("retry-after")) > 0);
});
