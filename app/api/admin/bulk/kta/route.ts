import { requireAdmin } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { logRouteError } from "@/lib/route-log";
import { SORTS, type Sort } from "@/lib/queries";
import { parseIds, parseKind, resolveIds } from "@/lib/bulk-guard";
import { BULK_MAX, publicJob, startBulkJob } from "@/lib/kta-bulk";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * POST /api/admin/bulk/kta, mulai ekspor massal.
 * Body: `{ kind: "pdf" | "jpg", ids?: string[], all?: boolean, q?, education?, dateFrom?, dateTo?, sort? }`
 * `all` memakai filter tabel yang aktif, bukan hanya halaman yang tampil.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

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
    ids = await resolveIds({ all: true }, filter);
  } else {
    const parsed = parseIds(body.ids);
    if (!parsed) return jsonError(400, "VALIDATION", "ids harus daftar id peserta");
    ids = parsed;
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
    logRouteError("POST /api/admin/bulk/kta", err);
    return jsonError(503, "SERVER_ERROR", "Layanan sedang tidak tersedia. Coba lagi nanti.");
  }
}
