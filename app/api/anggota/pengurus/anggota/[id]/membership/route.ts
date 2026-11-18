import { prisma } from "@/lib/prisma";
import { requirePengurus } from "@/lib/auth";
import { inScope, appointableLevels } from "@/lib/pengurus";
import { getMembership, getMembershipHistory, updateMembership } from "@/lib/membership";
import { jsonError } from "@/lib/http";
import { logRouteError } from "@/lib/route-log";

const SCOPE_SELECT = { provinceCode: true, regencyCode: true } as const;

/**
 * Cakupan wilayah + keberadaan peserta. Luar cakupan = 404 yang sama dengan
 * "tidak ada" supaya keberadaan peserta di luar wilayah tidak bocor.
 */
async function scopedTarget(
  actor: { provinceCode: string | null; regencyCode: string | null; levelCode: number; participantId: string },
  raw: string,
): Promise<"invalid" | "db_error" | "out_of_scope" | "ok"> {
  if (!/^\d{1,20}$/.test(raw)) return "invalid";
  let p;
  try {
    p = await prisma.participant.findUnique({
      where: { id: BigInt(raw) },
      select: SCOPE_SELECT,
    });
  } catch (err) {
    logRouteError("pengurus membership scope", err);
    return "db_error";
  }
  if (!p || !inScope(actor, p)) return "out_of_scope";
  return "ok";
}

/** GET /api/anggota/pengurus/anggota/[id]/membership, data keanggotaan. */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requirePengurus();
  if (!auth.ok) return auth.response;

  const { id: raw } = await ctx.params;
  const guard = await scopedTarget(auth.actor, raw);
  if (guard === "invalid" || guard === "out_of_scope") {
    return jsonError(404, "NOT_FOUND", "Data peserta tidak ditemukan");
  }
  if (guard === "db_error") {
    return jsonError(503, "SERVER_ERROR", "Layanan sedang tidak tersedia. Coba lagi nanti.");
  }

  const r = await getMembership(BigInt(raw));
  if (!r.ok) return jsonError(r.status, r.code, r.message);
  const history = await getMembershipHistory(BigInt(raw));
  return Response.json({ ok: true, data: { ...r.data, history } });
}

/** PATCH /api/anggota/pengurus/anggota/[id]/membership, ubah keanggotaan. */
export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requirePengurus();
  if (!auth.ok) return auth.response;

  const { id: raw } = await ctx.params;
  const guard = await scopedTarget(auth.actor, raw);
  if (guard === "invalid" || guard === "out_of_scope") {
    return jsonError(404, "NOT_FOUND", "Data peserta tidak ditemukan");
  }
  if (guard === "db_error") {
    return jsonError(503, "SERVER_ERROR", "Layanan sedang tidak tersedia. Coba lagi nanti.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "VALIDATION", "Body harus JSON valid");
  }

  const r = await updateMembership(BigInt(raw), body, {
    allowedLevels: appointableLevels(auth.actor),
    actor: { kind: "pengurus", id: auth.actor.participantId },
  });
  if (!r.ok) {
    return jsonError(
      r.status,
      r.code,
      r.message,
      r.errors ? { errors: r.errors } : undefined,
    );
  }
  return Response.json({ ok: true, data: r.data });
}
