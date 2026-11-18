import { requirePengurus } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { logRouteError } from "@/lib/route-log";
import { canIssueKta, inScope } from "@/lib/pengurus";
import { issueKta } from "@/lib/kta-issue";
import { prisma } from "@/lib/prisma";
import { parseIds } from "@/lib/bulk-guard";

/**
 * POST /api/anggota/pengurus/bulk/terbitkan, pengurus menerbitkan nomor
 * untuk banyak anggota sekaligus, tetap dibatasi cakupan wilayah dan aturan
 * level (`canIssueKta`) yang sama dengan penerbitan satuan.
 */
export async function POST(request: Request) {
  const auth = await requirePengurus();
  if (!auth.ok) return auth.response;
  const actor = auth.actor;

  let body: Record<string, unknown>;
  try {
    body = ((await request.json()) ?? {}) as Record<string, unknown>;
  } catch {
    return jsonError(400, "VALIDATION", "Body harus JSON valid");
  }

  const ids = parseIds(body.ids);
  if (!ids) return jsonError(400, "VALIDATION", "ids harus daftar id peserta");
  if (ids.length === 0) return jsonError(400, "VALIDATION", "Tidak ada peserta yang dipilih");

  const issued: string[] = [];
  const skipped: { label: string; reason: string }[] = [];

  for (const raw of ids) {
    let scope;
    try {
      scope = await prisma.participant.findUnique({
        where: { id: BigInt(raw) },
        select: { levelCode: true, provinceCode: true, regencyCode: true },
      });
    } catch (err) {
      logRouteError("POST /api/anggota/pengurus/bulk/terbitkan scope", err);
      skipped.push({ label: `#${raw}`, reason: "Gagal membaca data peserta" });
      continue;
    }
    if (!scope || !inScope(actor, scope)) {
      skipped.push({ label: `#${raw}`, reason: "Di luar wilayah kerja Anda" });
      continue;
    }
    const boleh = canIssueKta(actor, scope);
    if (!boleh.ok) {
      skipped.push({ label: `#${raw}`, reason: boleh.reason });
      continue;
    }
    try {
      const r = await issueKta({
        participantId: BigInt(raw),
        request,
        actor: { participantId: BigInt(actor.participantId) },
      });
      if (r.ok) issued.push(raw);
      else skipped.push({ label: `#${raw}`, reason: r.message });
    } catch (err) {
      logRouteError("POST /api/anggota/pengurus/bulk/terbitkan", err);
      skipped.push({ label: `#${raw}`, reason: "Gagal menerbitkan nomor" });
    }
  }

  return Response.json({ ok: true, data: { issued: issued.length, skipped } });
}
