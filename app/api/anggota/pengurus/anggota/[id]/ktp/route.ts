import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { requirePengurus } from "@/lib/auth";
import { inScope } from "@/lib/pengurus";
import { KTP_DIR } from "@/lib/photo";
import { jsonError } from "@/lib/http";

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * Serve foto KTP untuk pengurus — hanya peserta di dalam cakupan wilayahnya.
 * File di luar `public/`, tidak pernah statis.
 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requirePengurus();
  if (!auth.ok) return auth.response;

  const { id: raw } = await ctx.params;
  if (!/^\d{1,20}$/.test(raw)) return jsonError(404, "NOT_FOUND", "Foto KTP tidak ditemukan");

  const p = await prisma.participant.findUnique({
    where: { id: BigInt(raw) },
    select: { ktpPath: true, provinceCode: true, regencyCode: true },
  });
  // Di luar cakupan = 404, bukan 403: jangan bocorkan keberadaan peserta.
  if (!p || !inScope(auth.actor, p)) {
    return jsonError(404, "NOT_FOUND", "Foto KTP tidak ditemukan");
  }

  const rel = p.ktpPath;
  const m = rel?.match(/^ktp\/\d{1,20}\.(jpg|png|webp)$/);
  if (!rel || !m) return jsonError(404, "NOT_FOUND", "Foto KTP tidak ditemukan");

  let buf: Buffer;
  try {
    buf = await readFile(path.join(KTP_DIR, path.basename(rel)));
  } catch {
    return jsonError(404, "NOT_FOUND", "Foto KTP tidak ditemukan");
  }

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": MIME_BY_EXT[m[1]],
      "Cache-Control": "private, no-store",
    },
  });
}
