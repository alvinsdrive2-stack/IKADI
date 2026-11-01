import { readFile } from "node:fs/promises";
import path from "node:path";
import { requireAdmin } from "@/lib/auth";
import { getParticipantKtpPath } from "@/lib/queries";
import { KTP_DIR } from "@/lib/photo";
import { jsonError } from "@/lib/http";

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Serve foto KTP — hanya admin. File di luar `public/`, tidak pernah statis. */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id: raw } = await ctx.params;
  if (!/^\d{1,20}$/.test(raw)) return jsonError(404, "NOT_FOUND", "Foto KTP tidak ditemukan");

  const rel = await getParticipantKtpPath(BigInt(raw));
  // Path dari DB sudah ditulis oleh saveParticipantKtp; validasi ulang tetap dijaga.
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
