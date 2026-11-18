import { requireAdmin } from "@/lib/auth";
import { isValidLevel } from "@/lib/member-number";
import { issueKta } from "@/lib/kta-issue";
import { jsonError } from "@/lib/http";

/**
 * POST /api/admin/participants/:id/kta
 * Body opsional `{ levelCode?: number }` (1..7), diteruskan sebagai override
 * level saat penerbitan nomor pertama. Tanpa body, perilaku sama seperti dulu.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const adminId = BigInt(auth.session.adminId!);

  const { id: raw } = await ctx.params;
  if (!/^\d{1,20}$/.test(raw)) {
    return jsonError(404, "NOT_FOUND", "Data peserta tidak ditemukan");
  }

  let levelCodeOverride: number | undefined;
  let bodyText = "";
  try {
    bodyText = await request.text();
  } catch {
    // Tanpa body sama sekali, jalankan default.
  }
  if (bodyText.trim()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      return jsonError(400, "VALIDATION", "Body harus JSON valid");
    }
    const b = (parsed ?? {}) as Record<string, unknown>;
    if (b.levelCode !== null && b.levelCode !== undefined) {
      if (typeof b.levelCode !== "number" || !Number.isInteger(b.levelCode) || !isValidLevel(b.levelCode)) {
        return jsonError(400, "VALIDATION", "Level harus angka 1..7");
      }
      levelCodeOverride = b.levelCode;
    }
  }

  const result = await issueKta({
    participantId: BigInt(raw),
    request,
    actor: { adminId },
    levelCodeOverride,
  });
  if (!result.ok) {
    return jsonError(result.status, result.code, result.message);
  }
  return Response.json({ ok: true, data: result.data });
}
