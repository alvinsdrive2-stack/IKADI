import { requirePengurus } from "@/lib/auth";
import { inScope } from "@/lib/pengurus";
import { jsonError } from "@/lib/http";
import {
  createMemberCard,
  memberCardOwnerScope,
  readMemberCards,
} from "@/lib/member-cards-route";

/**
 * Pengurus boleh menyentuh kartu peserta di wilayah kerjanya. Nomor anggota
 * tidak mengubah level/wilayah, jadi aturan level-minimum `canIssueKta`
 * (khusus penerbitan pertama) tidak berlaku di sini.
 */
async function guard(
  actor: { participantId: string; levelCode: number; provinceCode: string | null; regencyCode: string | null },
  raw: string,
): Promise<Response | null> {
  const owner = await memberCardOwnerScope(raw);
  if (owner === "invalid" || owner === "missing") {
    return jsonError(404, "NOT_FOUND", "Data peserta tidak ditemukan");
  }
  if (owner === "db_error") {
    return jsonError(503, "SERVER_ERROR", "Layanan sedang tidak tersedia. Coba lagi nanti.");
  }
  if (!inScope(actor, owner)) {
    return jsonError(404, "NOT_FOUND", "Data peserta tidak ditemukan");
  }
  return null;
}

/** GET /api/anggota/pengurus/anggota/:id/kartu — riwayat kartu. */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePengurus();
  if (!auth.ok) return auth.response;

  const { id: raw } = await ctx.params;
  const denied = await guard(auth.actor, raw);
  if (denied) return denied;
  return readMemberCards(ctx);
}

/** POST — terbitkan kartu baru (otomatis / nomor manual). */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePengurus();
  if (!auth.ok) return auth.response;

  const { id: raw } = await ctx.params;
  const denied = await guard(auth.actor, raw);
  if (denied) return denied;

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text.trim()) body = JSON.parse(text);
  } catch {
    return jsonError(400, "VALIDATION", "Body harus JSON valid");
  }
  return createMemberCard(ctx, body);
}
