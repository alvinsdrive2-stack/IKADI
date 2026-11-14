import { prisma } from "@/lib/prisma";
import { requirePengurus } from "@/lib/auth";
import { LEVEL_LABELS } from "@/lib/member-number";
import { appointableLevels, scopeWhere } from "@/lib/pengurus";
import { jsonError } from "@/lib/http";
import { logRouteError } from "@/lib/route-log";

/** GET /api/anggota/pengurus/pengurus — daftar pengurus dalam cakupan aktor. */
export async function GET() {
  const auth = await requirePengurus();
  if (!auth.ok) return auth.response;
  const actor = auth.actor;

  let rows;
  try {
    rows = await prisma.participant.findMany({
      where: { AND: [scopeWhere(actor), { isPengurus: true }] },
      orderBy: [{ levelCode: "asc" }, { fullName: "asc" }],
      select: {
        id: true,
        fullName: true,
        levelCode: true,
        provinceCode: true,
        regencyCode: true,
        memberNumber: true,
        membershipStatus: true,
        createdAt: true,
      },
    });
  } catch (err) {
    logRouteError("GET /api/anggota/pengurus/pengurus", err);
    return jsonError(503, "SERVER_ERROR", "Layanan sedang tidak tersedia. Coba lagi nanti.");
  }

  // Nama wilayah per baris via master (hindari N+1: satu query per tabel lalu petakan).
  const provinceCodes = [...new Set(rows.map((r) => r.provinceCode).filter((c): c is string => !!c))];
  const regencyPairs = [
    ...new Set(
      rows
        .filter((r) => r.provinceCode && r.regencyCode)
        .map((r) => `${r.provinceCode}|${r.regencyCode}`),
    ),
  ];
  const [provinces, regencies] = await Promise.all([
    provinceCodes.length
      ? prisma.province.findMany({ where: { code: { in: provinceCodes } }, select: { code: true, name: true } })
      : Promise.resolve([] as { code: string; name: string }[]),
    regencyPairs.length
      ? prisma.regency.findMany({
          where: {
            OR: regencyPairs.map((pair) => {
              const [provinceCode, code] = pair.split("|");
              return { provinceCode, code };
            }),
          },
          select: { provinceCode: true, code: true, name: true },
        })
      : Promise.resolve([] as { provinceCode: string; code: string; name: string }[]),
  ]);
  const provinceNames = new Map(provinces.map((p) => [p.code, p.name]));
  const regencyNames = new Map(regencies.map((r) => [`${r.provinceCode}|${r.code}`, r.name]));

  return Response.json({
    ok: true,
    data: rows.map((r) => ({
      id: String(r.id),
      fullName: r.fullName,
      levelCode: r.levelCode,
      levelLabel: LEVEL_LABELS[r.levelCode] ?? "Pengurus",
      provinceName: r.provinceCode ? (provinceNames.get(r.provinceCode) ?? null) : null,
      regencyName:
        r.provinceCode && r.regencyCode
          ? (regencyNames.get(`${r.provinceCode}|${r.regencyCode}`) ?? null)
          : null,
      memberNumber: r.memberNumber,
      membershipStatus: r.membershipStatus,
      createdAt: r.createdAt.toISOString(),
    })),
    appointableLevels: appointableLevels(actor),
    selfId: actor.participantId,
  });
}
