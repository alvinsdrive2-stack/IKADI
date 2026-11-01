/** Client OCR KTP — panggil microservice Python (ocr-service/). */

export type OcrField = { value: string | null; confidence: number };

export type OcrResult = {
  ok: true;
  fields: Record<string, OcrField>;
  threshold: number;
  engine: string;
  durationMs: number;
};

/**
 * Deteksi via `.name`, bukan `instanceof` — modul ini di-load lewat
 * `--experimental-transform-types` (QA mock loader) sehingga kelas Error
 * bisa berasal dari realm/module instance berbeda.
 */
export class OcrUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OcrUnavailableError";
  }
}

const SERVICE_URL = process.env.OCR_SERVICE_URL ?? "http://127.0.0.1:8001";
const TIMEOUT_MS = Number(process.env.OCR_TIMEOUT_MS ?? 20_000);

export async function extractKtp(buf: Buffer, filename = "ktp.jpg"): Promise<OcrResult> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buf)]), filename);

  let res: Response;
  try {
    res = await fetch(`${SERVICE_URL}/extract`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    // Timeout/fetch gagal — log penyebabnya biar 503 di client gak jadi misteri.
    console.error("[ocr] fetch ke service gagal:", err);
    throw new OcrUnavailableError("OCR service tidak terjangkau");
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[ocr] service error ${res.status}: ${detail.slice(0, 500)}`);
    throw new OcrUnavailableError(`OCR service error: ${res.status}`);
  }

  const body = (await res.json()) as OcrResult | { ok: false };
  if (!body || body.ok !== true) {
    throw new OcrUnavailableError("OCR service balas tidak valid");
  }
  return body;
}
