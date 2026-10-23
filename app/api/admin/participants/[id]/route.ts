import { requireAdmin } from "@/lib/auth";
import { getParticipant } from "@/lib/queries";
import { jsonError } from "@/lib/http";


export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id: raw } = await ctx.params;
  if (!/^\d{1,20}$/.test(raw)) return jsonError(404, "NOT_FOUND", "Data peserta tidak ditemukan");

  const data = await getParticipant(BigInt(raw));
  if (!data) return jsonError(404, "NOT_FOUND", "Data peserta tidak ditemukan");

  return Response.json({ ok: true, data });
}
