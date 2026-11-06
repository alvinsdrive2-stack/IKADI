import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { LEVEL_LABELS, issueMemberNumber, isValidLevel } from "@/lib/member-number";
import { KTA_QR_COLOR, getPejabat } from "@/lib/kta";
import { jsonError } from "@/lib/http";
import { logRouteError, isUniqueViolation } from "@/lib/route-log";

/** Base URL publik untuk QR. Di produksi wajib di-set agar QR tidak menunjuk localhost. */
function baseUrl(request: Request): string {
  const configured = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

const KTA_PRINT_LIMIT = Number(process.env.KTA_PRINT_LIMIT ?? 10);

const SELECT = {
  id: true,
  fullName: true,
  originType: true,
  originName: true,
  levelCode: true,
  provinceCode: true,
  regencyCode: true,
  memberNumber: true,
  memberNumberIssuedAt: true,
  createdAt: true,
  photoPath: true,
} as const;

type KtaParticipant = {
  id: bigint;
  fullName: string;
  originType: "PW" | "PD";
  originName: string;
  levelCode: number;
  provinceCode: string | null;
  regencyCode: string | null;
  memberNumber: string | null;
  memberNumberIssuedAt: Date | null;
  createdAt: Date;
  photoPath: string | null;
};

/**
 * POST /api/admin/participants/:id/kta
 * Memanggil = mencetak = memakai kuota — HANYA saat penerbitan nomor pertama.
 * Nomor yang sudah ada tidak diterbitkan ulang dan cetak ulang tidak memakai kuota.
 * Kalau nomor anggota belum ada: terbitkan atomik (permanen) lalu insert `kta_prints`.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const adminId = BigInt(auth.session.adminId!);

  const { id: raw } = await ctx.params;
  if (!/^\d{1,20}$/.test(raw)) {
    return jsonError(404, "NOT_FOUND", "Data peserta tidak ditemukan");
  }

  let p: KtaParticipant | null;
  try {
    p = await prisma.participant.findUnique({ where: { id: BigInt(raw) }, select: SELECT });
  } catch (err) {
    logRouteError("POST /api/admin/participants/[id]/kta load", err);
    return jsonError(503, "SERVER_ERROR", "Layanan sedang tidak tersedia. Coba lagi nanti.");
  }
  if (!p) return jsonError(404, "NOT_FOUND", "Data peserta tidak ditemukan");

  // Eligibility: wilayah lengkap + level valid.
  if (!p.provinceCode || !p.regencyCode || !isValidLevel(p.levelCode)) {
    return jsonError(
      409,
      "NOT_ELIGIBLE",
      "Peserta belum punya wilayah (provinsi + kabupaten/kota) atau level tidak valid. Lengkapi dulu di menu Kelola Keanggotaan sebelum mencetak KTA.",
    );
  }

  // Kuota dari DB (bukan in-memory): COUNT(kta_prints).
  // Kuota hanya dicek saat penerbitan nomor pertama. Cetak ulang nomor yang sudah
  // terbit tidak memakai kuota — nomornya permanen, kartunya boleh dicetak berkali-kali.
  let printed: number;
  try {
    printed = await prisma.ktaPrint.count();
  } catch (err) {
    logRouteError("POST /api/admin/participants/[id]/kta count", err);
    return jsonError(503, "SERVER_ERROR", "Layanan sedang tidak tersedia. Coba lagi nanti.");
  }
  if (!p.memberNumber && printed >= KTA_PRINT_LIMIT) {
    return jsonError(
      409,
      "PRINT_LIMIT_REACHED",
      `Kuota cetak KTA untuk trial sudah habis (${KTA_PRINT_LIMIT}/${KTA_PRINT_LIMIT}).`,
    );
  }

  // Terbitkan nomor kalau belum ada. Atomik via $transaction + upsert increment.
  let memberNumber = p.memberNumber;
  let issued = false;
  // issuedAt = tanggal cetak (untuk teks "terdaftar sejak" di kartu).
  let issuedAt: Date = p.memberNumberIssuedAt ?? new Date();
  if (!memberNumber) {
    // YY di nomor = tahun pendaftaran (`created_at`), bukan tahun cetak. Nomor
    // permanen, jadi peserta yang daftar 2026 lalu dicetak 2027 tetap 26.
    const year = p.createdAt.getFullYear();
    try {
      const result = await prisma.$transaction(async (tx) => {
        const { memberNumber: mn } = await issueMemberNumber(tx, {
          levelCode: p!.levelCode,
          provinceCode: p!.provinceCode!,
          regencyCode: p!.regencyCode!,
          year,
        });
        const now = new Date();
        await tx.participant.update({
          where: { id: p!.id },
          data: { memberNumber: mn, memberNumberIssuedAt: now },
        });
        return { memberNumber: mn, issuedAt: now };
      });
      memberNumber = result.memberNumber;
      issuedAt = result.issuedAt;
      issued = true;
    } catch (err) {
      if (isUniqueViolation(err)) {
        // Race: admin lain sudah menerbitkan nomor untuk peserta ini di antara load & update.
        // Baca ulang dan pakai nomor yang ada.
        const existing = await prisma.participant.findUnique({
          where: { id: p.id },
          select: { memberNumber: true, memberNumberIssuedAt: true },
        });
        if (existing?.memberNumber) {
          memberNumber = existing.memberNumber;
          issuedAt = existing.memberNumberIssuedAt ?? new Date();
          issued = false;
        } else {
          // Tabrakan dengan peserta lain (sangat tak mungkin, tapi jaga-jaga).
          logRouteError("POST /api/admin/participants/[id]/kta issue (race)", err);
          return jsonError(500, "SERVER_ERROR", "Gagal menerbitkan nomor anggota. Coba lagi.");
        }
      } else {
        logRouteError("POST /api/admin/participants/[id]/kta issue", err);
        return jsonError(503, "SERVER_ERROR", "Layanan sedang tidak tersedia. Coba lagi nanti.");
      }
    }
  }

  // Riwayat cetak = sumber kuota. Baris hanya dibuat saat nomor pertama kali terbit,
  // jadi cetak ulang tidak menambah pemakaian kuota. Gagal insert jangan 500:
  // nomor sudah permanen, ini insiden audit saja.
  let remainingPrints = Math.max(0, KTA_PRINT_LIMIT - printed);
  if (issued) {
    try {
      await prisma.ktaPrint.create({
        data: {
          participantId: p.id,
          memberNumber: memberNumber!,
          printedByAdminId: adminId,
        },
      });
      remainingPrints = Math.max(0, KTA_PRINT_LIMIT - (printed + 1));
    } catch (err) {
      logRouteError("POST /api/admin/participants/[id]/kta print", err);
    }
  }

  // Nama wilayah untuk kartu.
  const [prov, reg] = await Promise.all([
    prisma.province.findUnique({ where: { code: p.provinceCode! }, select: { name: true } }),
    prisma.regency.findUnique({
      where: { provinceCode_code: { provinceCode: p.provinceCode!, code: p.regencyCode! } },
      select: { name: true },
    }),
  ]);

  const verifyUrl = `${baseUrl(request)}/verifikasi/${encodeURIComponent(memberNumber!)}`;
  let qrPng: string;
  try {
    qrPng = await QRCode.toDataURL(verifyUrl, {
      width: 600,
      margin: 1,
      errorCorrectionLevel: "M",
      color: KTA_QR_COLOR,
    });
  } catch {
    return jsonError(500, "SERVER_ERROR", "Gagal membuat QR verifikasi");
  }

  return Response.json({
    ok: true,
    data: {
      memberNumber,
      issued,
      fullName: p.fullName,
      originType: p.originType,
      originName: p.originName,
      levelLabel: LEVEL_LABELS[p.levelCode] ?? "Anggota",
      provinceName: prov?.name ?? null,
      regencyName: reg?.name ?? null,
      photoPath: p.photoPath,
      issuedAt: issuedAt.toISOString(),
      verifyUrl,
      qrPng,
      remainingPrints,
      pejabat: await getPejabat(),
    },
  });
}
