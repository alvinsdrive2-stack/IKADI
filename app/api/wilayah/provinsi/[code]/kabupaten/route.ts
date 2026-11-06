import { prisma } from "@/lib/prisma";
import { REGENCIES } from "@/lib/wilayah";
import { jsonError } from "@/lib/http";

/**
 * GET /api/wilayah/provinsi/:code/kabupaten — urut kode.
 * 404 kalau kode provinsi tidak ada di master.
 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  if (!/^\d{2}$/.test(code)) {
    return jsonError(404, "NOT_FOUND", "Kode provinsi tidak dikenali");
  }

  let rows: { code: string; name: string }[];
  try {
    const [db, prov] = await Promise.all([
      prisma.regency.findMany({ where: { provinceCode: code }, orderBy: { code: "asc" } }),
      prisma.province.findUnique({ where: { code }, select: { code: true } }),
    ]);
    const provExists = prov !== null || REGENCIES.some((r) => r.provinceCode === code);
    if (!provExists) {
      return jsonError(404, "NOT_FOUND", "Kode provinsi tidak dikenali");
    }
    rows = db.length > 0 ? db : REGENCIES.filter((r) => r.provinceCode === code).map((r) => ({ code: r.code, name: r.name }));
  } catch {
    // DB down: fallback ke master statis. 404 tetap dideteksi dari master.
    const local = REGENCIES.filter((r) => r.provinceCode === code);
    if (local.length === 0) {
      return jsonError(404, "NOT_FOUND", "Kode provinsi tidak dikenali");
    }
    rows = local.map((r) => ({ code: r.code, name: r.name }));
  }

  return Response.json({ ok: true, data: rows });
}
