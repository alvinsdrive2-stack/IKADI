import { prisma } from "@/lib/prisma";
import { requireAnggota } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { logRouteError } from "@/lib/route-log";

/**
 * GET /api/anggota/profil/status — dipakai gate di area anggota untuk tahu
 * apakah peserta hasil impor masih wajib melengkapi profil.
 */
export async function GET() {
  const auth = await requireAnggota();
  if (!auth.ok) return auth.response;

  const id = auth.session.participantId!;
  if (!/^\d{1,20}$/.test(id)) {
    return jsonError(401, "UNAUTHORIZED", "Sesi tidak valid. Silakan login ulang.");
  }

  try {
    const p = await prisma.participant.findUnique({
      where: { id: BigInt(id) },
      select: { needsProfileCompletion: true },
    });
    if (!p) return jsonError(404, "NOT_FOUND", "Data peserta tidak ditemukan");
    return Response.json({ ok: true, data: { needsProfileCompletion: p.needsProfileCompletion } });
  } catch (err) {
    logRouteError("GET /api/anggota/profil/status", err);
    return jsonError(503, "SERVER_ERROR", "Layanan sedang tidak tersedia. Coba lagi nanti.");
  }
}
