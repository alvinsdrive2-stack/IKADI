import { prisma } from "@/lib/prisma";
import { PROVINCES } from "@/lib/wilayah";

/** GET /api/wilayah/provinsi — 34 item urut kode. Baca DB, fallback ke lib/wilayah.ts. */
export async function GET() {
  let rows: { code: string; name: string }[];
  try {
    const db = await prisma.province.findMany({ orderBy: { code: "asc" } });
    rows = db.length > 0 ? db : [...PROVINCES].sort((a, b) => a.code.localeCompare(b.code));
  } catch {
    // DB down / belum di-seed: pakai master statis supaya dropdown tetap jalan.
    rows = [...PROVINCES].sort((a, b) => a.code.localeCompare(b.code));
  }
  return Response.json({ ok: true, data: rows });
}
