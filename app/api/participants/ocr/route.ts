import { extractKtp } from "@/lib/ocr";
import { detectImageExt } from "@/lib/photo";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp, jsonError } from "@/lib/http";

// Node runtime default; `export const runtime` tidak kompatibel cacheComponents.

export async function POST(request: Request) {
  const rl = rateLimit(`ocr:${clientIp(request)}`, 10, 10 * 60_000);
  if (!rl.allowed) {
    return Response.json(
      { ok: false, code: "RATE_LIMIT", message: "Terlalu banyak percobaan OCR. Coba lagi nanti." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let file: FormDataEntryValue | null = null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return jsonError(400, "VALIDATION", "Body harus multipart/form-data");
  }
  if (!(file instanceof File)) {
    return jsonError(400, "VALIDATION", "File KTP wajib diunggah");
  }
  if (file.size > 10 * 1024 * 1024) {
    return jsonError(413, "VALIDATION", "Ukuran foto KTP maksimal 10 MB");
  }

  const buf = Buffer.from(await file.arrayBuffer());
  // Magic bytes — nama file/Content-Type dari client tidak pernah dipercaya.
  if (!detectImageExt(buf)) {
    return jsonError(400, "VALIDATION", "Foto KTP harus JPEG, PNG, atau WebP");
  }

  try {
    const result = await extractKtp(buf, file.name || "ktp.jpg");
    return Response.json(result);
  } catch (err) {
    // `.name`, bukan `instanceof` — lihat catatan di lib/ocr.ts.
    if ((err as { name?: string }).name === "OcrUnavailableError") {
      return jsonError(503, "OCR_UNAVAILABLE", "Layanan OCR sedang tidak tersedia. Isi data secara manual.");
    }
    throw err;
  }
}
