import { requireAdmin } from "@/lib/auth";
import { getParticipant } from "@/lib/queries";
import { updateParticipantProfile } from "@/lib/participant-profile";
import { deleteParticipant } from "@/lib/participant-delete";
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

/**
 * PATCH data pribadi peserta. Hanya admin; wilayah dan NIK punya jalur sendiri
 * (`/membership` dan alur pendaftaran) dan tidak bisa diubah dari sini.
 */
export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id: raw } = await ctx.params;
  if (!/^\d{1,20}$/.test(raw)) return jsonError(404, "NOT_FOUND", "Data peserta tidak ditemukan");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "VALIDATION", "Body harus JSON valid");
  }

  const result = await updateParticipantProfile(BigInt(raw), body);
  if (result.ok) return Response.json({ ok: true, data: result.data });

  if (result.errors) {
    return Response.json(
      { ok: false, code: result.code, message: result.message, errors: result.errors },
      { status: result.status },
    );
  }
  return jsonError(result.status, result.code, result.message);
}
/**
 * DELETE peserta. Permanen: kartu, riwayat keanggotaan, riwayat cetak, pas foto,
 * dan foto KTP ikut hilang. Hanya admin, dan tidak tersedia untuk pengurus.
 */
export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id: raw } = await ctx.params;
  if (!/^\d{1,20}$/.test(raw)) return jsonError(404, "NOT_FOUND", "Data peserta tidak ditemukan");

  const result = await deleteParticipant(BigInt(raw));
  if (result.ok) return Response.json({ ok: true, data: result.data });
  return jsonError(result.status, result.code, result.message);
}
