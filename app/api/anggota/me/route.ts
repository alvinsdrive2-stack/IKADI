import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { requireAnggota } from "@/lib/auth";
import { LEVEL_LABELS } from "@/lib/member-number";
import { PENGURUS_MAX_LEVEL } from "@/lib/pengurus";
import { KTA_QR_COLOR, getPejabat, type KtaPejabatMap } from "@/lib/kta";
import { jsonError } from "@/lib/http";
import { logRouteError } from "@/lib/route-log";
import { publicBaseUrl, verifyPath } from "@/lib/base-url";


export async function GET(request: Request) {
  const auth = await requireAnggota();
  if (!auth.ok) return auth.response;

  const id = auth.session.participantId!;
  if (!/^\d{1,20}$/.test(id)) {
    return jsonError(401, "UNAUTHORIZED", "Sesi tidak valid. Silakan login ulang.");
  }

  let p;
  try {
    p = await prisma.participant.findUnique({
      where: { id: BigInt(id) },
      select: {
        fullName: true,
        nik: true,
        levelCode: true,
        isPengurus: true,
        membershipStatus: true,
        provinceCode: true,
        regencyCode: true,
        memberNumber: true,
        memberNumberIssuedAt: true,
        createdAt: true,
        photoPath: true,
      },
    });
  } catch (err) {
    logRouteError("GET /api/anggota/me", err);
    return jsonError(503, "SERVER_ERROR", "Layanan sedang tidak tersedia. Coba lagi nanti.");
  }

  if (!p) return jsonError(401, "UNAUTHORIZED", "Sesi tidak valid. Silakan login ulang.");

  // Join nama wilayah via master (kode di participants, nama dari tabel provinces/regencies).
  let provinceName: string | null = null;
  let regencyName: string | null = null;
  if (p.provinceCode) {
    const [prov, reg] = await Promise.all([
      prisma.province.findUnique({ where: { code: p.provinceCode }, select: { name: true } }),
      p.regencyCode
        ? prisma.regency.findUnique({
            where: { provinceCode_code: { provinceCode: p.provinceCode, code: p.regencyCode } },
            select: { name: true },
          })
        : Promise.resolve(null),
    ]);
    provinceName = prov?.name ?? null;
    regencyName = reg?.name ?? null;
  }

  let kta: { verifyUrl: string; qrPng: string; issuedAt: string; pejabat: KtaPejabatMap } | null = null;
  if (p.memberNumber) {
    const verifyUrl = `${publicBaseUrl(request)}${verifyPath(p.memberNumber)}`;
    try {
      const qrPng = await QRCode.toDataURL(verifyUrl, {
        width: 600,
        margin: 1,
        errorCorrectionLevel: "M",
        color: KTA_QR_COLOR,
      });
      kta = {
        verifyUrl,
        qrPng,
        issuedAt: p.memberNumberIssuedAt?.toISOString() ?? p.createdAt.toISOString(),
        pejabat: await getPejabat(),
      };
    } catch {
      // QR gagal: profil tetap tampil, kartu cetak punya error sendiri.
      kta = null;
    }
  }

  return Response.json({
    ok: true,
    data: {
      fullName: p.fullName,
      nik: p.nik,
      levelCode: p.levelCode,
      levelLabel: LEVEL_LABELS[p.levelCode] ?? "Anggota",
      /** Peran pengurus: memberi akses menu pengurus. Level 1..3 saja. */
      isPengurus: p.isPengurus && p.levelCode <= PENGURUS_MAX_LEVEL,
      membershipStatus: p.membershipStatus,
      province: provinceName,
      city: regencyName,
      memberNumber: p.memberNumber,
      memberNumberIssuedAt: p.memberNumberIssuedAt?.toISOString() ?? null,
      memberSince: p.createdAt.toISOString(),
      photoPath: p.photoPath,
      kta,
    },
  });
}
