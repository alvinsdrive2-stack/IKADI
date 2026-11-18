import { prisma } from "@/lib/prisma";
import { requirePengurus } from "@/lib/auth";
import { LEVEL_LABELS } from "@/lib/member-number";
import { appointableLevels, scopeWhere, type Actor } from "@/lib/pengurus";
import { jsonError } from "@/lib/http";
import { logRouteError } from "@/lib/route-log";

/** Nama wilayah kerja aktor dari master provinces/regencies. */
async function wilayahNames(actor: Actor) {
  const [prov, reg] = await Promise.all([
    actor.provinceCode
      ? prisma.province.findUnique({ where: { code: actor.provinceCode }, select: { name: true } })
      : null,
    actor.provinceCode && actor.regencyCode
      ? prisma.regency.findUnique({
          where: {
            provinceCode_code: { provinceCode: actor.provinceCode, code: actor.regencyCode },
          },
          select: { name: true },
        })
      : null,
  ]);
  return { provinceName: prov?.name ?? null, regencyName: reg?.name ?? null };
}

/** GET /api/anggota/pengurus/me, profil peran + jumlah anggota dalam cakupan. */
export async function GET() {
  const auth = await requirePengurus();
  if (!auth.ok) return auth.response;
  const actor = auth.actor;

  try {
    const [anggota, pengurus, wilayah] = await Promise.all([
      prisma.participant.count({ where: scopeWhere(actor) }),
      prisma.participant.count({
        where: { AND: [scopeWhere(actor), { isPengurus: true }] },
      }),
      wilayahNames(actor),
    ]);

    return Response.json({
      ok: true,
      data: {
        levelCode: actor.levelCode,
        levelLabel: LEVEL_LABELS[actor.levelCode] ?? "Pengurus",
        provinceCode: actor.provinceCode,
        provinceName: wilayah.provinceName,
        regencyCode: actor.regencyCode,
        regencyName: wilayah.regencyName,
        appointableLevels: appointableLevels(actor),
        counts: { anggota, pengurus },
      },
    });
  } catch (err) {
    logRouteError("GET /api/anggota/pengurus/me", err);
    return jsonError(503, "SERVER_ERROR", "Layanan sedang tidak tersedia. Coba lagi nanti.");
  }
}
