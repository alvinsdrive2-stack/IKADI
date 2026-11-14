/**
 * Penerbitan KTA — dipakai route admin (/api/admin/participants/:id/kta)
 * dan route pengurus supaya aturan penerbitan nomor cuma ada di satu tempat.
 * Cetak tidak dibatasi kuota.
 */
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { LEVEL_LABELS, issueMemberNumber, isValidLevel } from "@/lib/member-number";
import { KTA_QR_COLOR, getPejabat, type KtaPejabatMap } from "@/lib/kta";
import { logRouteError, isUniqueViolation } from "@/lib/route-log";
import { publicBaseUrl, verifyPath } from "@/lib/base-url";


const SELECT = {
  id: true,
  fullName: true,
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
  levelCode: number;
  provinceCode: string | null;
  regencyCode: string | null;
  memberNumber: string | null;
  memberNumberIssuedAt: Date | null;
  createdAt: Date;
  photoPath: string | null;
};

/** Siapa yang mencetak: admin (area /admin) atau pengurus (area /anggota). Tepat satu terisi. */
export type PrintActor = { adminId?: bigint; participantId?: bigint };

export type IssueData = {
  memberNumber: string | null;
  issued: boolean;
  fullName: string;
  /** Level hasil akhir — bisa berubah karena levelCodeOverride saat penerbitan pertama. */
  levelCode: number;
  levelLabel: string;
  /** true kalau levelCodeOverride dikirim tapi diabaikan karena nomor sudah terbit. */
  levelLocked: boolean;
  provinceName: string | null;
  regencyName: string | null;
  photoPath: string | null;
  issuedAt: string;
  verifyUrl: string;
  qrPng: string;
  pejabat: KtaPejabatMap;
};

export type IssueResult =
  | { ok: true; data: IssueData }
  | { ok: false; status: number; code: string; message: string };

const fail = (status: number, code: string, message: string): IssueResult => ({
  ok: false,
  status,
  code,
  message,
});

/**
 * Terbitkan/cetak KTA untuk satu peserta.
 *
 * - Nomor belum ada: terbitkan atomik (permanen) lalu insert `kta_prints`.
 *   Kalau `levelCodeOverride` dikirim, level peserta di-update ke nilai itu
 *   di dalam transaksi yang sama, dan nomor diterbitkan memakai level tersebut.
 * - Nomor sudah ada: tidak diterbitkan ulang, `levelCodeOverride` diabaikan
 *   (level terkunci) → `levelLocked: true`.
 */
export async function issueKta(opts: {
  participantId: bigint;
  /** Untuk publicBaseUrl(request) saat membuat QR. */
  request: Request;
  actor: PrintActor;
  /** Level yang dipakai saat menerbitkan nomor. Default: level peserta saat load. */
  levelCodeOverride?: number;
}): Promise<IssueResult> {
  const hasAdmin = opts.actor.adminId !== undefined;
  const hasParticipant = opts.actor.participantId !== undefined;
  if (hasAdmin === hasParticipant) {
    return fail(500, "SERVER_ERROR", "Aktor cetak tidak valid");
  }

  if (opts.levelCodeOverride !== undefined && !isValidLevel(opts.levelCodeOverride)) {
    return fail(400, "VALIDATION", "Level harus angka 1..7");
  }

  let p: KtaParticipant | null;
  try {
    p = await prisma.participant.findUnique({ where: { id: opts.participantId }, select: SELECT });
  } catch (err) {
    logRouteError("POST /api/admin/participants/[id]/kta load", err);
    return fail(503, "SERVER_ERROR", "Layanan sedang tidak tersedia. Coba lagi nanti.");
  }
  if (!p) return fail(404, "NOT_FOUND", "Data peserta tidak ditemukan");

  const firstIssue = !p.memberNumber;
  // Override hanya berlaku saat penerbitan pertama; setelah nomor terbit level terkunci.
  const applyLevel = firstIssue && opts.levelCodeOverride !== undefined ? opts.levelCodeOverride : null;
  const effectiveLevel = applyLevel ?? p.levelCode;

  // Eligibility: wilayah lengkap + level valid.
  if (!p.provinceCode || !p.regencyCode || !isValidLevel(effectiveLevel)) {
    return fail(
      409,
      "NOT_ELIGIBLE",
      "Peserta belum punya wilayah (provinsi + kabupaten/kota) atau level tidak valid. Lengkapi dulu di menu Kelola Keanggotaan sebelum mencetak KTA.",
    );
  }

  // Terbitkan nomor kalau belum ada. Atomik via $transaction + upsert increment.
  let memberNumber = p.memberNumber;
  let issued = false;
  // issuedAt = tanggal cetak (untuk teks "terdaftar sejak" di kartu).
  let issuedAt: Date = p.memberNumberIssuedAt ?? new Date();
  let finalLevel = p.levelCode;
  if (firstIssue) {
    // YY di nomor = tahun pendaftaran (`created_at`), bukan tahun cetak. Nomor
    // permanen, jadi peserta yang daftar 2026 lalu dicetak 2027 tetap 26.
    const year = p.createdAt.getFullYear();
    try {
      const result = await prisma.$transaction(async (tx) => {
        const { memberNumber: mn } = await issueMemberNumber(tx, {
          levelCode: effectiveLevel,
          provinceCode: p!.provinceCode!,
          regencyCode: p!.regencyCode!,
          year,
        });
        const now = new Date();
        await tx.participant.update({
          where: { id: p!.id },
          data: {
            memberNumber: mn,
            memberNumberIssuedAt: now,
            // Override level diterapkan atomik bersama penerbitan nomor.
            ...(applyLevel !== null ? { levelCode: applyLevel } : {}),
          },
        });
        return { memberNumber: mn, issuedAt: now };
      });
      memberNumber = result.memberNumber;
      issuedAt = result.issuedAt;
      issued = true;
      if (applyLevel !== null) finalLevel = applyLevel;
    } catch (err) {
      if (isUniqueViolation(err)) {
        // Race: pihak lain sudah menerbitkan nomor untuk peserta ini di antara load & update.
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
          return fail(500, "SERVER_ERROR", "Gagal menerbitkan nomor anggota. Coba lagi.");
        }
      } else {
        logRouteError("POST /api/admin/participants/[id]/kta issue", err);
        return fail(503, "SERVER_ERROR", "Layanan sedang tidak tersedia. Coba lagi nanti.");
      }
    }
  }

  // Riwayat cetak: baris hanya dibuat saat nomor pertama kali terbit, jadi cetak
  // ulang tidak menambah baris. Gagal insert jangan 500 — nomor sudah permanen,
  // ini insiden audit saja.
  if (issued) {
    try {
      await prisma.ktaPrint.create({
        data: {
          participantId: p.id,
          memberNumber: memberNumber!,
          ...(hasAdmin
            ? { printedByAdminId: opts.actor.adminId! }
            : { printedByParticipantId: opts.actor.participantId! }),
        },
      });
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

  // true kalau override dikirim tapi tidak diterapkan (nomor sudah ada / kalah race).
  const levelLocked = opts.levelCodeOverride !== undefined && !issued;

  const verifyUrl = `${publicBaseUrl(opts.request)}${verifyPath(memberNumber!)}`;
  let qrPng: string;
  try {
    qrPng = await QRCode.toDataURL(verifyUrl, {
      width: 600,
      margin: 1,
      errorCorrectionLevel: "M",
      color: KTA_QR_COLOR,
    });
  } catch {
    return fail(500, "SERVER_ERROR", "Gagal membuat QR verifikasi");
  }

  return {
    ok: true,
    data: {
      memberNumber,
      issued,
      fullName: p.fullName,
      levelCode: finalLevel,
      levelLabel: LEVEL_LABELS[finalLevel] ?? "Anggota",
      levelLocked,
      provinceName: prov?.name ?? null,
      regencyName: reg?.name ?? null,
      photoPath: p.photoPath,
      issuedAt: issuedAt.toISOString(),
      verifyUrl,
      qrPng,
      pejabat: await getPejabat(),
    },
  };
}
