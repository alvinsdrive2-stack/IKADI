import { requireAdmin } from "@/lib/auth";
import { listParticipants, SORTS, type Sort } from "@/lib/queries";
import { jsonError } from "@/lib/http";


const ORIGIN_TYPES = ["PW", "PD"] as const;
const SERMONS = ["SERING", "KADANG_KADANG", "BELUM_PERNAH", "LAINNYA"] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const sp = new URL(request.url).searchParams;
  const str = (k: string, max = 200) => {
    const v = sp.get(k)?.trim();
    return v ? v.slice(0, max) : undefined;
  };

  const originTypeRaw = sp.get("originType") ?? undefined;
  if (originTypeRaw && !ORIGIN_TYPES.includes(originTypeRaw as "PW" | "PD")) {
    return jsonError(400, "VALIDATION", "originType harus PW atau PD");
  }
  const sermonRaw = sp.get("sermon") ?? undefined;
  if (sermonRaw && !(SERMONS as readonly string[]).includes(sermonRaw)) {
    return jsonError(400, "VALIDATION", "Nilai sermon tidak valid");
  }
  const sortRaw = sp.get("sort") ?? "newest";
  if (!(SORTS as readonly string[]).includes(sortRaw)) {
    return jsonError(400, "VALIDATION", "Nilai sort tidak valid");
  }
  const dateFrom = sp.get("dateFrom") ?? undefined;
  const dateTo = sp.get("dateTo") ?? undefined;
  if ((dateFrom && !DATE_RE.test(dateFrom)) || (dateTo && !DATE_RE.test(dateTo))) {
    return jsonError(400, "VALIDATION", "Format tanggal harus YYYY-MM-DD");
  }

  const page = Math.max(1, Math.floor(Number(sp.get("page")) || 1));
  const perPageRaw = Math.floor(Number(sp.get("perPage")) || 20);
  const perPage = [10, 20, 50, 100].includes(perPageRaw) ? perPageRaw : 20;

  const result = await listParticipants({
    q: str("q", 100),
    originType: originTypeRaw as "PW" | "PD" | undefined,
    originName: str("originName", 150),
    education: str("education", 100),
    sermon: sermonRaw as (typeof SERMONS)[number] | undefined,
    dateFrom,
    dateTo,
    sort: sortRaw as Sort,
    page,
    perPage,
  });

  return Response.json({ ok: true, ...result });
}
