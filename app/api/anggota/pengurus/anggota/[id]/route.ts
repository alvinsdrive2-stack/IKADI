import { prisma } from "@/lib/prisma";
import { requirePengurus } from "@/lib/auth";
import { LEVEL_LABELS } from "@/lib/member-number";
import { inScope, isPengurusLevel } from "@/lib/pengurus";
import { jsonError } from "@/lib/http";
import { logRouteError } from "@/lib/route-log";

const SELECT = {
  id: true,
  fullName: true,
  nik: true,
  whatsapp: true,
  levelCode: true,
  isPengurus: true,
  membershipStatus: true,
  provinceCode: true,
  regencyCode: true,
  memberNumber: true,
  passwordHash: true,
  createdAt: true,
  photoPath: true,
  ktpPath: true,
} as const;

/**
 * GET /api/anggota/pengurus/anggota/[id], detail peserta dalam cakupan.
 * Luar cakupan = 404 yang sama dengan "tidak ada" (tidak membocorkan keberadaan).
 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requirePengurus();
  if (!auth.ok) return auth.response;

  const { id: raw } = await ctx.params;
  if (!/^\d{1,20}$/.test(raw)) return jsonError(404, "NOT_FOUND", "Data peserta tidak ditemukan");

  let p;
  try {
    p = await prisma.participant.findUnique({ where: { id: BigInt(raw) }, select: SELECT });
  } catch (err) {
    logRouteError("GET /api/anggota/pengurus/anggota/[id]", err);
    return jsonError(503, "SERVER_ERROR", "Layanan sedang tidak tersedia. Coba lagi nanti.");
  }
  if (!p || !inScope(auth.actor, p)) {
    return jsonError(404, "NOT_FOUND", "Data peserta tidak ditemukan");
  }

  const [provinceName, regencyName] = await Promise.all([
    p.provinceCode
      ? prisma.province.findUnique({ where: { code: p.provinceCode }, select: { name: true } })
      : null,
    p.provinceCode && p.regencyCode
      ? prisma.regency.findUnique({
          where: {
            provinceCode_code: { provinceCode: p.provinceCode, code: p.regencyCode },
          },
          select: { name: true },
        })
      : null,
  ]);

  return Response.json({
    ok: true,
    data: {
      id: String(p.id),
      fullName: p.fullName,
      nik: p.nik,
      whatsapp: p.whatsapp,
      levelCode: p.levelCode,
      levelLabel: LEVEL_LABELS[p.levelCode] ?? "Anggota",
      isPengurus: p.isPengurus && isPengurusLevel(p.levelCode),
      membershipStatus: p.membershipStatus,
      provinceName: provinceName?.name ?? null,
      regencyName: regencyName?.name ?? null,
      memberNumber: p.memberNumber,
      hasPassword: !!p.passwordHash,
      createdAt: p.createdAt.toISOString(),
      photoPath: p.photoPath,
      ktpPath: p.ktpPath,
    },
  });
}
