import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { logRouteError } from "@/lib/route-log";
import {
  KTA_JABATAN_DEFAULT,
  KTA_KEYS,
  getPejabat,
  type KtaKey,
  type KtaPejabatMap,
} from "@/lib/kta";

type Row = { key: string; nama: string; jabatan: string; updatedAt: Date };

function shape(pejabat: KtaPejabatMap, rows: Row[]) {
  const updatedAt = rows.reduce<Date | null>(
    (acc, r) => (acc && acc > r.updatedAt ? acc : r.updatedAt),
    null,
  );
  return {
    ketuaUmum: { key: "ketuaUmum" as const, ...pejabat.ketuaUmum },
    sekjen: { key: "sekjen" as const, ...pejabat.sekjen },
    // false = belum pernah disimpan di DB, kartu memakai fallback env.
    savedInDb: rows.length > 0,
    updatedAt: updatedAt?.toISOString() ?? null,
  };
}

async function loadRows(): Promise<Row[]> {
  const rows = await prisma.ktaOfficial.findMany({
    select: { key: true, nama: true, jabatan: true, updatedAt: true },
  });
  return rows as Row[];
}

/** GET /api/admin/kta/pejabat — nama Ketua Umum & Sekjen untuk blok TTD KTA. */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const [pejabat, rows] = await Promise.all([getPejabat(), loadRows()]);
    return Response.json({ ok: true, data: shape(pejabat, rows) });
  } catch (err) {
    logRouteError("GET /api/admin/kta/pejabat", err);
    return jsonError(503, "SERVER_ERROR", "Layanan sedang tidak tersedia. Coba lagi nanti.");
  }
}

/**
 * PATCH /api/admin/kta/pejabat
 * Body: { ketuaUmum?: { nama, jabatan? }, sekjen?: { nama, jabatan? } }
 * Upsert per kunci — hanya kunci yang dikirim yang berubah.
 */
export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "VALIDATION", "Body harus JSON valid");
  }
  const b = (body ?? {}) as Record<string, unknown>;

  const errors: Record<string, string> = {};
  const updates: { key: KtaKey; nama: string; jabatan: string }[] = [];

  for (const key of KTA_KEYS) {
    if (!(key in b) || b[key] === null || b[key] === undefined) continue;
    const raw = b[key] as Record<string, unknown>;
    if (typeof raw !== "object") {
      errors[key] = "Format harus objek { nama, jabatan }";
      continue;
    }
    const nama = typeof raw.nama === "string" ? raw.nama.trim() : "";
    const jabatanRaw = typeof raw.jabatan === "string" ? raw.jabatan.trim() : "";
    if (!nama) {
      errors[`${key}.nama`] = "Nama pejabat wajib diisi";
      continue;
    }
    if (nama.length > 200) {
      errors[`${key}.nama`] = "Nama pejabat maksimal 200 karakter";
      continue;
    }
    const jabatan = jabatanRaw || KTA_JABATAN_DEFAULT[key];
    if (jabatan.length > 120) {
      errors[`${key}.jabatan`] = "Jabatan maksimal 120 karakter";
      continue;
    }
    updates.push({ key, nama, jabatan });
  }

  if (Object.keys(errors).length > 0) {
    return Response.json(
      { ok: false, code: "VALIDATION", message: "Periksa kembali isian Anda.", errors },
      { status: 400 },
    );
  }
  if (updates.length === 0) {
    return jsonError(400, "VALIDATION", "Tidak ada pejabat yang dikirim (ketuaUmum / sekjen)");
  }

  try {
    await prisma.$transaction(
      updates.map((u) =>
        prisma.ktaOfficial.upsert({
          where: { key: u.key },
          create: { key: u.key, nama: u.nama, jabatan: u.jabatan },
          update: { nama: u.nama, jabatan: u.jabatan },
        }),
      ),
    );
  } catch (err) {
    logRouteError("PATCH /api/admin/kta/pejabat", err);
    return jsonError(503, "SERVER_ERROR", "Layanan sedang tidak tersedia. Coba lagi nanti.");
  }

  const [pejabat, rows] = await Promise.all([getPejabat(), loadRows()]);
  return Response.json({ ok: true, data: shape(pejabat, rows) });
}
