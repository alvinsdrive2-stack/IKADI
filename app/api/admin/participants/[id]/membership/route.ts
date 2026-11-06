import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { LEVEL_LABELS, isValidLevel } from "@/lib/member-number";
import { jsonError } from "@/lib/http";
import { logRouteError, isUniqueViolation } from "@/lib/route-log";
import type { MembershipStatus } from "@prisma/client";

const STATUSES = ["AKTIF", "NONAKTIF", "PURNABAKTI"] as const;

type MembershipRow = {
  id: bigint;
  fullName: string;
  levelCode: number;
  provinceCode: string | null;
  regencyCode: string | null;
  memberNumber: string | null;
  memberNumberIssuedAt: Date | null;
  membershipStatus: MembershipStatus;
  passwordHash: string | null;
};

/** Response shape: MembershipAdmin (sama untuk GET dan PATCH). */
function shape(
  p: MembershipRow,
  wilayah: { provinceName: string | null; regencyName: string | null },
) {
  const eligible = !!p.provinceCode && !!p.regencyCode && isValidLevel(p.levelCode);
  let ineligibleReason: string | null = null;
  if (!eligible) {
    if (!p.provinceCode || !p.regencyCode) {
      ineligibleReason = "Wilayah (provinsi dan kabupaten/kota) belum dilengkapi. Lengkapi dulu sebelum cetak KTA.";
    } else {
      ineligibleReason = "Kode level tidak valid (harus 1..7). Hubungi admin pusat.";
    }
  }
  return {
    participantId: String(p.id),
    fullName: p.fullName,
    levelCode: p.levelCode,
    levelLabel: LEVEL_LABELS[p.levelCode] ?? "Tidak diketahui",
    provinceCode: p.provinceCode,
    provinceName: wilayah.provinceName,
    regencyCode: p.regencyCode,
    regencyName: wilayah.regencyName,
    memberNumber: p.memberNumber,
    memberNumberIssuedAt: p.memberNumberIssuedAt?.toISOString() ?? null,
    membershipStatus: p.membershipStatus,
    hasPassword: !!p.passwordHash,
    eligible,
    ineligibleReason,
  };
}

async function loadWilayah(p: { provinceCode: string | null; regencyCode: string | null }) {
  if (!p.provinceCode) return { provinceName: null, regencyName: null };
  const [prov, reg] = await Promise.all([
    prisma.province.findUnique({ where: { code: p.provinceCode }, select: { name: true } }),
    p.regencyCode
      ? prisma.regency.findUnique({
          where: { provinceCode_code: { provinceCode: p.provinceCode, code: p.regencyCode } },
          select: { name: true },
        })
      : Promise.resolve(null),
  ]);
  return { provinceName: prov?.name ?? null, regencyName: reg?.name ?? null };
}

const SELECT = {
  id: true,
  fullName: true,
  levelCode: true,
  provinceCode: true,
  regencyCode: true,
  memberNumber: true,
  memberNumberIssuedAt: true,
  membershipStatus: true,
  passwordHash: true,
} as const;

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id: raw } = await ctx.params;
  if (!/^\d{1,20}$/.test(raw)) {
    return jsonError(404, "NOT_FOUND", "Data peserta tidak ditemukan");
  }

  let p: MembershipRow | null;
  try {
    p = await prisma.participant.findUnique({ where: { id: BigInt(raw) }, select: SELECT });
  } catch (err) {
    logRouteError("GET /api/admin/participants/[id]/membership", err);
    return jsonError(503, "SERVER_ERROR", "Layanan sedang tidak tersedia. Coba lagi nanti.");
  }
  if (!p) return jsonError(404, "NOT_FOUND", "Data peserta tidak ditemukan");

  const wilayah = await loadWilayah(p);
  return Response.json({ ok: true, data: shape(p, wilayah) });
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id: raw } = await ctx.params;
  if (!/^\d{1,20}$/.test(raw)) {
    return jsonError(404, "NOT_FOUND", "Data peserta tidak ditemukan");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "VALIDATION", "Body harus JSON valid");
  }
  const b = (body ?? {}) as Record<string, unknown>;

  // --- Validasi ---
  const errors: Record<string, string> = {};

  if ("levelCode" in b && b.levelCode !== null && b.levelCode !== undefined) {
    if (typeof b.levelCode !== "number" || !Number.isInteger(b.levelCode) || !isValidLevel(b.levelCode)) {
      errors.levelCode = "Level harus angka 1..7";
    }
  }

  const wantsProvince = "provinceCode" in b && b.provinceCode !== null && b.provinceCode !== undefined;
  const wantsRegency = "regencyCode" in b && b.regencyCode !== null && b.regencyCode !== undefined;

  if (wantsProvince && typeof b.provinceCode !== "string") {
    errors.provinceCode = "Kode provinsi harus berupa kode 2 digit";
  } else if (wantsProvince && !/^\d{2}$/.test(b.provinceCode as string)) {
    errors.provinceCode = "Kode provinsi harus berupa kode 2 digit";
  }

  if (wantsRegency && typeof b.regencyCode !== "string") {
    errors.regencyCode = "Kode kabupaten/kota harus berupa kode 2 digit";
  } else if (wantsRegency && !/^\d{2}$/.test(b.regencyCode as string)) {
    errors.regencyCode = "Kode kabupaten/kota harus berupa kode 2 digit";
  }

  if (wantsProvince && !wantsRegency && !errors.provinceCode) {
    errors.regencyCode = "Kabupaten/kota wajib diisi bersamaan dengan provinsi";
  }
  if (wantsRegency && !wantsProvince && !errors.regencyCode) {
    errors.provinceCode = "Provinsi wajib diisi bersamaan dengan kabupaten/kota";
  }

  if ("membershipStatus" in b && b.membershipStatus !== null && b.membershipStatus !== undefined) {
    if (typeof b.membershipStatus !== "string" || !STATUSES.includes(b.membershipStatus as never)) {
      errors.membershipStatus = `Status harus salah satu: ${STATUSES.join(", ")}`;
    }
  }

  if ("newPassword" in b && b.newPassword !== null && b.newPassword !== undefined) {
    if (typeof b.newPassword !== "string" || b.newPassword.length < 8) {
      errors.newPassword = "Sandi baru minimal 8 karakter";
    }
  }

  if (Object.keys(errors).length > 0) {
    return Response.json(
      { ok: false, code: "VALIDATION", message: "Periksa kembali isian Anda.", errors },
      { status: 400 },
    );
  }

  // --- Load peserta (untuk cek nomor terbit) ---
  let current: MembershipRow | null;
  try {
    current = await prisma.participant.findUnique({ where: { id: BigInt(raw) }, select: SELECT });
  } catch (err) {
    logRouteError("PATCH /api/admin/participants/[id]/membership", err);
    return jsonError(503, "SERVER_ERROR", "Layanan sedang tidak tersedia. Coba lagi nanti.");
  }
  if (!current) return jsonError(404, "NOT_FOUND", "Data peserta tidak ditemukan");

  // Nomor terbit: level & wilayah dikunci permanen.
  const changesWilayah =
    ("levelCode" in b && b.levelCode !== null && b.levelCode !== undefined) ||
    wantsProvince || wantsRegency;
  if (current.memberNumber && changesWilayah) {
    return jsonError(
      409,
      "FORBIDDEN",
      "Nomor anggota sudah terbit. Level dan wilayah tidak bisa diubah.",
    );
  }

  // --- Validasi wilayah di master (baru kalau pasangan diubah) ---
  let provinceCode = current.provinceCode;
  let regencyCode = current.regencyCode;
  if (wantsProvince && wantsRegency) {
    provinceCode = b.provinceCode as string;
    regencyCode = b.regencyCode as string;
    const [prov, reg] = await Promise.all([
      prisma.province.findUnique({ where: { code: provinceCode }, select: { code: true } }),
      prisma.regency.findUnique({
        where: { provinceCode_code: { provinceCode, code: regencyCode } },
        select: { code: true },
      }),
    ]);
    if (!prov || !reg) {
      return jsonError(400, "VALIDATION", "Kode wilayah tidak ada di master");
    }
  } else if (wantsProvince || wantsRegency) {
    // Seharusnya tak sampai sini (sudah ditangkap di atas), tapi jaga-jaga.
    return jsonError(400, "VALIDATION", "Provinsi dan kabupaten/kota wajib berpasangan");
  }

  // --- Update ---
  const data: Record<string, unknown> = {};
  if ("levelCode" in b && b.levelCode !== null && b.levelCode !== undefined) {
    data.levelCode = b.levelCode as number;
  }
  if (wantsProvince && wantsRegency) {
    data.provinceCode = provinceCode;
    data.regencyCode = regencyCode;
  }
  if ("membershipStatus" in b && b.membershipStatus !== null && b.membershipStatus !== undefined) {
    data.membershipStatus = b.membershipStatus as MembershipStatus;
  }
  if ("newPassword" in b && b.newPassword !== null && b.newPassword !== undefined) {
    data.passwordHash = await hashPassword(b.newPassword as string);
  }

  let updated: MembershipRow;
  try {
    updated = await prisma.participant.update({
      where: { id: BigInt(raw) },
      data,
      select: SELECT,
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      // member_number punya unique index — nilai dikunci, jadi ini tak seharusnya.
      return jsonError(409, "FORBIDDEN", "Nomor anggota sudah terbit. Level dan wilayah tidak bisa diubah.");
    }
    logRouteError("PATCH /api/admin/participants/[id]/membership", err);
    return jsonError(503, "SERVER_ERROR", "Layanan sedang tidak tersedia. Coba lagi nanti.");
  }

  const wilayah = await loadWilayah(updated);
  return Response.json({ ok: true, data: shape(updated, wilayah) });
}
