import { requirePengurus } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { logRouteError } from "@/lib/route-log";
import { scopeWhere } from "@/lib/pengurus";
import { SORTS, type Sort } from "@/lib/queries";
import { parseIds, parseKind, resolveIds, filterExisting } from "@/lib/bulk-guard";
import { BULK_MAX, publicJob, startBulkJob } from "@/lib/kta-bulk";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * POST /api/anggota/pengurus/bulk/kta, ekspor massal untuk wilayah pengurus.
 * `scopeWhere` selalu dikirim, dan id manual disaring ulang ke cakupan itu.
 */
export async function POST(request: Request) {
  const auth = await requirePengurus();
  if (!auth.ok) return auth.response;
  const actor = auth.actor;
  const scope = scopeWhere(actor);

  let body: Record<string, unknown>;
  try {
    body = ((await request.json()) ?? {}) as Record<string, unknown>;
  } catch {
    return jsonError(400, "VALIDATION", "Body harus JSON valid");
  }

  const kind = parseKind(body.kind);
  if (!kind) return jsonError(400, "VALIDATION", "Jenis ekspor harus pdf atau jpg");

  const sortRaw = typeof body.sort === "string" && (SORTS as readonly string[]).includes(body.sort) ? body.sort : "newest";
  const dateFrom = typeof body.dateFrom === "string" ? body.dateFrom : undefined;
  const dateTo = typeof body.dateTo === "string" ? body.dateTo : undefined;
  if ((dateFrom && !DATE_RE.test(dateFrom)) || (dateTo && !DATE_RE.test(dateTo))) {
    return jsonError(400, "VALIDATION", "Format tanggal harus YYYY-MM-DD");
  }
  const filter = {
    q: typeof body.q === "string" ? body.q.slice(0, 100) : undefined,
    education: typeof body.education === "string" ? body.education.slice(0, 100) : undefined,
    dateFrom,
    dateTo,
    sort: sortRaw as Sort,
  };

  let ids: string[];
  if (body.all === true) {
    ids = await resolveIds({ all: true }, filter, scope);
  } else {
    const parsed = parseIds(body.ids);
    if (!parsed) return jsonError(400, "VALIDATION", "ids harus daftar id peserta");
    ids = await filterExisting(parsed, {
      provinceCode: actor.levelCode <= 1 ? undefined : actor.provinceCode,
      regencyCode: actor.levelCode <= 2 ? undefined : actor.regencyCode,
    });
  }
  if (ids.length === 0) return jsonError(400, "VALIDATION", "Tidak ada peserta yang dipilih");
  if (body.all === true && ids.length > BULK_MAX) {
    return jsonError(
      400,
      "VALIDATION",
      `Filter cocok dengan ${ids.length} peserta, melebihi batas ${BULK_MAX} per ekspor. Persempit filter atau centang peserta.`,
    );
  }

  try {
    const job = startBulkJob(ids, kind, request);
    return Response.json({ ok: true, data: publicJob(job) });
  } catch (err) {
    logRouteError("POST /api/anggota/pengurus/bulk/kta", err);
    return jsonError(503, "SERVER_ERROR", "Layanan sedang tidak tersedia. Coba lagi nanti.");
  }
}
