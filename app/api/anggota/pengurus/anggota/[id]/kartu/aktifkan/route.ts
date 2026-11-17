import { requirePengurus } from "@/lib/auth";
import { inScope } from "@/lib/pengurus";
import { activateCard, memberCardOwnerScope } from "@/lib/member-cards-route";
import { jsonError } from "@/lib/http";

/** POST /api/anggota/pengurus/anggota/:id/kartu/aktifkan — body `{ cardId }`. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePengurus();
  if (!auth.ok) return auth.response;

  const { id: raw } = await ctx.params;
  const owner = await memberCardOwnerScope(raw);
  if (owner === "invalid" || owner === "missing") {
    return jsonError(404, "NOT_FOUND", "Data peserta tidak ditemukan");
  }
  if (owner === "db_error") {
    return jsonError(503, "SERVER_ERROR", "Layanan sedang tidak tersedia. Coba lagi nanti.");
  }
  if (!inScope(auth.actor, owner)) {
    return jsonError(404, "NOT_FOUND", "Data peserta tidak ditemukan");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "VALIDATION", "Body harus JSON valid");
  }
  return activateCard(ctx, body);
}
