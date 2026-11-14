/**
 * Logika keanggotaan (level, wilayah, status, sandi) — dipakai route admin
 * dan route pengurus supaya aturannya tunggal, tidak ada dua implementasi.
 * Hasil berbentuk union `ok` supaya route cukup memetakan ke Response.
 */
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { LEVEL_LABELS, isValidLevel } from "@/lib/member-number";
import { logRouteError, isUniqueViolation } from "@/lib/route-log";
import type { MembershipStatus } from "@prisma/client";

const STATUSES = ["AKTIF", "NONAKTIF", "PURNABAKTI"] as const;

export type MembershipRow = {
  id: bigint;
  fullName: string;
  levelCode: number;
  provinceCode: string | null;
  regencyCode: string | null;
  memberNumber: string | null;
  memberNumberIssuedAt: Date | null;
  membershipStatus: MembershipStatus;
  passwordHash: string | null;
  isPengurus: boolean;
};

/** Response shape: MembershipAdmin (sama untuk GET dan PATCH). */
export function shape(
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
    isPengurus: p.isPengurus,
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
  isPengurus: true,
} as const;

export type MembershipPatch = {
  levelCode?: number;
  provinceCode?: string;
  regencyCode?: string;
  membershipStatus?: MembershipStatus;
  newPassword?: string;
  /** Peran pengurus. Melantik wajib menyertakan levelCode 1..3. */
  isPengurus?: boolean;
};

export type MembershipError = {
  ok: false;
  status: number;
  code: string;
  message: string;
  errors?: Record<string, string>;
};

export type MembershipResult =
  | { ok: true; data: ReturnType<typeof shape> }
  | MembershipError;

export type UpdateResult = MembershipResult;

export async function getMembership(id: bigint): Promise<MembershipResult> {
  let p: MembershipRow | null;
  try {
    p = await prisma.participant.findUnique({ where: { id }, select: SELECT });
  } catch (err) {
    logRouteError("GET /api/admin/participants/[id]/membership", err);
    return {
      ok: false,
      status: 503,
      code: "SERVER_ERROR",
      message: "Layanan sedang tidak tersedia. Coba lagi nanti.",
    };
  }
  if (!p) {
    return { ok: false, status: 404, code: "NOT_FOUND", message: "Data peserta tidak ditemukan" };
  }
  const wilayah = await loadWilayah(p);
  return { ok: true, data: shape(p, wilayah) };
}

/**
 * Update keanggotaan. `patch` adalah body mentah (unknown) — seluruh validasi
 * tipe dilakukan di sini supaya route cukup meneruskan.
 * `opts.allowedLevels`: kalau diberikan (pemakaian pengurus), levelCode harus
 * ada di array itu; kalau tidak diberikan (admin) berlaku aturan lama 1..7.
 */
export async function updateMembership(
  id: bigint,
  patch: unknown,
  opts?: { allowedLevels?: number[] },
): Promise<UpdateResult> {
  const b = (patch ?? {}) as Record<string, unknown>;

  // --- Validasi ---
  const errors: Record<string, string> = {};

  const wantsLevel = "levelCode" in b && b.levelCode !== null && b.levelCode !== undefined;
  if (wantsLevel) {
    if (typeof b.levelCode !== "number" || !Number.isInteger(b.levelCode) || !isValidLevel(b.levelCode)) {
      errors.levelCode = "Level harus angka 1..7";
    } else if (opts?.allowedLevels && !opts.allowedLevels.includes(b.levelCode)) {
      return {
        ok: false,
        status: 400,
        code: "VALIDATION",
        message: `Level ${b.levelCode} tidak boleh Anda tetapkan.`,
        errors: { levelCode: `Level ${b.levelCode} tidak boleh Anda tetapkan.` },
      };
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

  if ("isPengurus" in b && b.isPengurus !== null && b.isPengurus !== undefined) {
    if (typeof b.isPengurus !== "boolean") {
      errors.isPengurus = "isPengurus harus boolean";
    }
  }

  if (Object.keys(errors).length > 0) {
    return {
      ok: false,
      status: 400,
      code: "VALIDATION",
      message: "Periksa kembali isian Anda.",
      errors,
    };
  }

  // --- Load peserta (untuk cek nomor terbit) ---
  let current: MembershipRow | null;
  try {
    current = await prisma.participant.findUnique({ where: { id }, select: SELECT });
  } catch (err) {
    logRouteError("PATCH /api/admin/participants/[id]/membership", err);
    return {
      ok: false,
      status: 503,
      code: "SERVER_ERROR",
      message: "Layanan sedang tidak tersedia. Coba lagi nanti.",
    };
  }
  if (!current) {
    return { ok: false, status: 404, code: "NOT_FOUND", message: "Data peserta tidak ditemukan" };
  }

  // Nomor terbit: level & wilayah dikunci permanen.
  const changesWilayah = wantsLevel || wantsProvince || wantsRegency;
  if (current.memberNumber && changesWilayah) {
    return {
      ok: false,
      status: 409,
      code: "FORBIDDEN",
      message: "Nomor anggota sudah terbit. Level dan wilayah tidak bisa diubah.",
    };
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
      return { ok: false, status: 400, code: "VALIDATION", message: "Kode wilayah tidak ada di master" };
    }
  } else if (wantsProvince || wantsRegency) {
    // Seharusnya tak sampai sini (sudah ditangkap di atas), tapi jaga-jaga.
    return {
      ok: false,
      status: 400,
      code: "VALIDATION",
      message: "Provinsi dan kabupaten/kota wajib berpasangan",
    };
  }

  // --- Update ---
  const data: Record<string, unknown> = {};
  if (wantsLevel) {
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
  if ("isPengurus" in b && typeof b.isPengurus === "boolean") {
    data.isPengurus = b.isPengurus;
  }

  let updated: MembershipRow;
  try {
    updated = await prisma.participant.update({
      where: { id },
      data,
      select: SELECT,
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      // member_number punya unique index — nilai dikunci, jadi ini tak seharusnya.
      return {
        ok: false,
        status: 409,
        code: "FORBIDDEN",
        message: "Nomor anggota sudah terbit. Level dan wilayah tidak bisa diubah.",
      };
    }
    logRouteError("PATCH /api/admin/participants/[id]/membership", err);
    return {
      ok: false,
      status: 503,
      code: "SERVER_ERROR",
      message: "Layanan sedang tidak tersedia. Coba lagi nanti.",
    };
  }

  const wilayah = await loadWilayah(updated);
  return { ok: true, data: shape(updated, wilayah) };
}
