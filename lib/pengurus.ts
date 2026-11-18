import type { Prisma } from "@prisma/client";

/**
 * Aturan peran pengurus, satu sumber untuk area /admin dan /anggota.
 *
 * Peran TIDAK ditentukan `levelCode` (level cuma jenis kepengurusan, banyak
 * anggota level 6). Yang memberi akses menu pengurus adalah `isPengurus`.
 * Level 1..3 menentukan cakupan wilayah dan siapa yang boleh diangkat.
 */

/** Id yang tidak pernah ada, filter "tidak boleh lihat apa pun". */
const NO_MATCH_ID = BigInt(-1);

export const PENGURUS_MIN_LEVEL = 1;
export const PENGURUS_MAX_LEVEL = 3;

/** Level 1..3 = Pusat, Wilayah, Daerah. Selain itu bukan pengurus. */
export function isPengurusLevel(level: number): boolean {
  return Number.isInteger(level) && level >= PENGURUS_MIN_LEVEL && level <= PENGURUS_MAX_LEVEL;
}

/** Aktor = orang yang sedang melakukan aksi. */
export type Actor = {
  participantId: string;
  levelCode: number;
  provinceCode: string | null;
  regencyCode: string | null;
};

/** Target = peserta yang jadi sasaran aksi. */
export type Target = {
  participantId: string;
  levelCode: number;
  provinceCode: string | null;
  regencyCode: string | null;
};

export type Decision = { ok: true } | { ok: false; reason: string };

/**
 * Filter Prisma untuk data yang boleh dilihat aktor.
 * Level 1 (pusat) tanpa batas; level 2 provinsinya; level 3 kab/kotanya.
 */
export function scopeWhere(actor: Actor): Prisma.ParticipantWhereInput {
  if (actor.levelCode <= 1) return {};
  if (actor.levelCode === 2) {
    // Provinsi belum diisi = tidak ada wilayah kerja; jangan bocorkan semua data.
    if (!actor.provinceCode) return { id: NO_MATCH_ID };
    return { provinceCode: actor.provinceCode };
  }
  if (!actor.provinceCode || !actor.regencyCode) return { id: NO_MATCH_ID };
  return { provinceCode: actor.provinceCode, regencyCode: actor.regencyCode };
}

/** Apakah target berada di cakupan wilayah aktor. */
export function inScope(actor: Actor, target: Pick<Target, "provinceCode" | "regencyCode">): boolean {
  if (actor.levelCode <= 1) return true;
  if (target.provinceCode !== actor.provinceCode) return false;
  if (actor.levelCode === 2) return true;
  return target.regencyCode === actor.regencyCode;
}

/** Level target yang boleh diangkat aktor: L1 -> 1/2/3, L2 -> 2/3, L3 -> 3. */
export function appointableLevels(actor: Actor): number[] {
  const from = Math.max(PENGURUS_MIN_LEVEL, Math.min(actor.levelCode, PENGURUS_MAX_LEVEL));
  return Array.from({ length: PENGURUS_MAX_LEVEL - from + 1 }, (_, i) => from + i);
}

/**
 * Boleh menerbitkan KTA untuk target ini?
 *
 * Menerbitkan KTA = menetapkan nomor anggota permanen, jadi hanya untuk peserta
 * di BAWAH level aktor. Level sama tidak boleh (L3 tidak menerbitkan untuk L3
 * lain), level di atas jelas tidak. Pusat (L1) hanya bisa untuk level 2..7.
 */
export function canIssueKta(
  actor: Actor,
  target: { levelCode: number; provinceCode: string | null; regencyCode: string | null },
): Decision {
  if (!inScope(actor, target)) {
    return { ok: false, reason: "Peserta ini di luar wilayah kerja Anda." };
  }
  if (target.levelCode <= actor.levelCode) {
    return {
      ok: false,
      reason: `Hanya bisa menerbitkan KTA untuk peserta di bawah level Anda (level ${actor.levelCode}).`,
    };
  }
  return { ok: true };
}

/**
 * Boleh melantik / mencabut target ini?
 *
 * - Level target harus ada di `appointableLevels(actor)` (juga membatasi 1..3).
 * - Wilayah target harus dalam cakupan aktor.
 * - Tidak boleh menargetkan diri sendiri (mencegah pengurus terakhir mengunci
 *   dirinya sendiri; admin tetap jadi jalan keluar).
 */
export function canManage(actor: Actor, target: Target): Decision {
  if (actor.participantId === target.participantId) {
    return { ok: false, reason: "Tidak bisa melantik atau mencabut diri sendiri." };
  }
  if (!isPengurusLevel(target.levelCode)) {
    return {
      ok: false,
      reason: `Level ${target.levelCode} bukan level pengurus. Hanya level 1..3 yang bisa dilantik.`,
    };
  }
  if (!appointableLevels(actor).includes(target.levelCode)) {
    return {
      ok: false,
      reason: `Level ${actor.levelCode} hanya bisa mengangkat level ${appointableLevels(actor).join("/")}.`,
    };
  }
  if (!inScope(actor, target)) {
    return { ok: false, reason: "Peserta ini di luar wilayah kerja Anda." };
  }
  return { ok: true };
}

/**
 * Alasan peserta tidak bisa dilantik, atau null kalau bisa.
 * Nomor anggota yang sudah terbit mengunci level, pelantikan tidak akan
 * memunculkan menu pengurus, jadi lebih baik ditolak dengan jelas.
 */
export function appointBlocker(target: {
  provinceCode: string | null;
  regencyCode: string | null;
  memberNumber: string | null;
}): string | null {
  if (target.memberNumber) {
    return "Nomor anggota sudah terbit, jadi level terkunci. Peserta tetap anggota biasa dan tidak akan mendapat menu pengurus.";
  }
  if (!target.provinceCode || !target.regencyCode) {
    return "Wilayah peserta belum lengkap. Lengkapi provinsi dan kabupaten/kota dulu.";
  }
  return null;
}
