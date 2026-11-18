import { requireAdmin } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { logRouteError } from "@/lib/route-log";
import { issueKta } from "@/lib/kta-issue";
import { parseIds } from "@/lib/bulk-guard";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/admin/bulk/terbitkan, terbitkan nomor untuk banyak peserta.
 * Hanya berlaku bagi peserta yang belum punya nomor; yang sudah punya nomor
 * dilewati (nomor bersifat permanen, bukan ditimpa).
 */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const adminId = BigInt(auth.session.adminId!);

  let body: Record<string, unknown>;
  try {
    body = ((await request.json()) ?? {}) as Record<string, unknown>;
  } catch {
    return jsonError(400, "VALIDATION", "Body harus JSON valid");
  }

  const ids = parseIds(body.ids);
  if (!ids) return jsonError(400, "VALIDATION", "ids harus daftar id peserta");
  if (ids.length === 0) return jsonError(400, "VALIDATION", "Tidak ada peserta yang dipilih");

  // Nama peserta diambil sekali di awal supaya pesan alasan bisa menyebut orang,
  // bukan id mentah yang tidak berarti bagi admin.
  const nameById = new Map(
    (
      await prisma.participant.findMany({
        where: { id: { in: ids.map((i) => BigInt(i)) } },
        select: { id: true, fullName: true },
      })
    ).map((p) => [String(p.id), p.fullName]),
  );
  const label = (raw: string) => nameById.get(raw) ?? `Peserta #${raw}`;

  const issued: string[] = [];
  const skipped: { label: string; reason: string }[] = [];

  for (const raw of ids) {
    try {
      const r = await issueKta({ participantId: BigInt(raw), request, actor: { adminId } });
      if (r.ok) issued.push(raw);
      else skipped.push({ label: label(raw), reason: r.message });
    } catch (err) {
      logRouteError("POST /api/admin/bulk/terbitkan", err);
      skipped.push({ label: label(raw), reason: "Gagal menerbitkan nomor" });
    }
  }

  return Response.json({ ok: true, data: { issued: issued.length, skipped } });
}
