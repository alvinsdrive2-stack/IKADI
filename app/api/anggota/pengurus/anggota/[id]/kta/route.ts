import { prisma } from "@/lib/prisma";
import { requirePengurus } from "@/lib/auth";
import { LEVEL_LABELS } from "@/lib/member-number";
import { appointableLevels, canIssueKta, inScope } from "@/lib/pengurus";
import { issueKta } from "@/lib/kta-issue";
import { jsonError } from "@/lib/http";
import { logRouteError } from "@/lib/route-log";

const SCOPE_SELECT = { levelCode: true, provinceCode: true, regencyCode: true } as const;

/**
 * POST /api/anggota/pengurus/anggota/[id]/kta, pengurus mencetak KTA anggota.
 * Hanya untuk peserta di BAWAH level aktor dan di dalam wilayah kerjanya.
 * Body opsional `{ levelCode }`: menetapkan level sekaligus saat cetak.
 * Level yang boleh diberikan dibatasi `appointableLevels` (level 3 hanya bisa
 * memberi level 3).
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requirePengurus();
  if (!auth.ok) return auth.response;
  const actor = auth.actor;

  const { id: raw } = await ctx.params;
  if (!/^\d{1,20}$/.test(raw)) return jsonError(404, "NOT_FOUND", "Data peserta tidak ditemukan");

  // Cakupan dulu, peserta luar wilayah diperlakukan seperti tidak ada.
  let scopeRow;
  try {
    scopeRow = await prisma.participant.findUnique({
      where: { id: BigInt(raw) },
      select: SCOPE_SELECT,
    });
  } catch (err) {
    logRouteError("POST /api/anggota/pengurus/anggota/[id]/kta scope", err);
    return jsonError(503, "SERVER_ERROR", "Layanan sedang tidak tersedia. Coba lagi nanti.");
  }
  if (!scopeRow || !inScope(actor, scopeRow)) {
    return jsonError(404, "NOT_FOUND", "Data peserta tidak ditemukan");
  }
  // Menerbitkan KTA = nomor permanen, jadi hanya untuk level di bawah aktor.
  const boleh = canIssueKta(actor, scopeRow);
  if (!boleh.ok) return jsonError(403, "FORBIDDEN", boleh.reason);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "VALIDATION", "Body harus JSON valid");
  }
  const b = (body ?? {}) as Record<string, unknown>;

  let levelCodeOverride: number | undefined;
  if (b.levelCode !== undefined && b.levelCode !== null) {
    if (
      typeof b.levelCode !== "number" ||
      !Number.isInteger(b.levelCode) ||
      !appointableLevels(actor).includes(b.levelCode)
    ) {
      const allowed = appointableLevels(actor)
        .map((l) => `${l} (${LEVEL_LABELS[l] ?? "?"})`)
        .join(", ");
      return jsonError(
        400,
        "VALIDATION",
        `Level tidak valid. Level ${actor.levelCode} hanya boleh memberi level: ${allowed}.`,
      );
    }
    levelCodeOverride = b.levelCode;
  }

  const r = await issueKta({
    participantId: BigInt(raw),
    request,
    actor: { participantId: BigInt(actor.participantId) },
    levelCodeOverride,
  });
  if (!r.ok) return jsonError(r.status, r.code, r.message);
  return Response.json({ ok: true, data: r.data });
}
