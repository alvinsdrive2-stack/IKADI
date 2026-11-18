/**
 * Kartu anggota (riwayat nomor), satu peserta boleh punya banyak kartu, tapi
 * hanya satu yang aktif. `participants.member_number` adalah cermin kartu aktif
 * dan HANYA ditulis dari file ini, supaya semua pembaca lama tetap benar.
 *
 * Aturan:
 * - Menerbitkan kartu pertama = nomor pertama peserta (aktif otomatis).
 * - Menerbitkan kartu berikutnya: kartu lama `retiredAt` diisi, kartu baru
 *   langsung aktif. Admin tetap bisa mengaktifkan kartu lama lewat
 *   `activateMemberCard`.
 * - Nomor kartu unik global (`uq_member_cards_number`).
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isValidLevel, issueMemberNumber } from "@/lib/member-number";
import { isUniqueViolation, logRouteError } from "@/lib/route-log";

/** Bentuk simpan nomor: L.WW.DD.YY.NNNN(N). Sama dengan yang dicetak. */
export const MEMBER_NUMBER_RE = /^[1-7]\.\d{2}\.\d{2}\.\d{2}\.\d{4,5}$/;

export type MemberCardRow = {
  id: bigint;
  memberNumber: string;
  levelCode: number;
  provinceCode: string;
  regencyCode: string;
  issuedAt: Date;
  isManual: boolean;
  isActive: boolean;
  retiredAt: Date | null;
};

export type MemberCardError = { ok: false; status: number; code: string; message: string };

export type IssueCardInput = {
  participantId: bigint;
  /** Nomor lengkap yang diketik admin. Kalau kosong, diterbitkan otomatis. */
  memberNumber?: string;
  /** Penanda asal nomor. Default: manual kalau `memberNumber` diisi. */
  isManual?: boolean;
  /** Tahun untuk serial otomatis. Default: tahun ini. */
  year?: number;
};

const select = {
  id: true,
  memberNumber: true,
  levelCode: true,
  provinceCode: true,
  regencyCode: true,
  issuedAt: true,
  isManual: true,
  isActive: true,
  retiredAt: true,
} as const;

const fail = (status: number, code: string, message: string): MemberCardError => ({
  ok: false,
  status,
  code,
  message,
});

/** Riwayat kartu peserta, terbaru dulu. */
export async function listMemberCards(participantId: bigint): Promise<MemberCardRow[]> {
  return prisma.memberCard.findMany({
    where: { participantId },
    orderBy: [{ isActive: "desc" }, { issuedAt: "desc" }, { id: "desc" }],
    select,
  });
}

/**
 * Terbitkan kartu baru untuk peserta dan jadikan aktif.
 *
 * Dijalankan dalam satu transaksi: kartu lain di-retire, kartu baru dibuat,
 * lalu `participants.member_number` dicerminkan. Nomor otomatis diambil dari
 * sequence yang sama dengan penerbitan pertama, jadi serial tidak bentrok.
 */
export async function issueMemberCard(
  input: IssueCardInput,
  tx?: Prisma.TransactionClient,
): Promise<{ ok: true; card: MemberCardRow } | MemberCardError> {
  const run = async (client: Prisma.TransactionClient) => {
    const owner = await client.participant.findUnique({
      where: { id: input.participantId },
      select: {
        id: true,
        levelCode: true,
        provinceCode: true,
        regencyCode: true,
        createdAt: true,
      },
    });
    if (!owner) return fail(404, "NOT_FOUND", "Data peserta tidak ditemukan");
    if (!owner.provinceCode || !owner.regencyCode) {
      return fail(409, "NOT_ELIGIBLE", "Wilayah peserta belum lengkap (provinsi dan kabupaten/kota).");
    }
    if (!isValidLevel(owner.levelCode)) {
      return fail(409, "NOT_ELIGIBLE", "Level peserta tidak valid (harus 1..7).");
    }

    let memberNumber: string;
    let isManual = false;
    if (input.memberNumber !== undefined) {
      const raw = input.memberNumber.trim();
      if (!MEMBER_NUMBER_RE.test(raw)) {
        return fail(400, "VALIDATION", "Format nomor harus seperti 6.16.01.26.00100.");
      }
      memberNumber = raw;
      isManual = true;
    } else {
      const year = input.year ?? new Date().getFullYear();
      const issued = await issueMemberNumber(client, {
        levelCode: owner.levelCode,
        provinceCode: owner.provinceCode,
        regencyCode: owner.regencyCode,
        year,
      });
      memberNumber = issued.memberNumber;
    }

    const now = new Date();
    // Kartu lama di-retire dulu supaya unique parsial tetap satu aktif.
    await client.memberCard.updateMany({
      where: { participantId: owner.id, isActive: true },
      data: { isActive: false, retiredAt: now },
    });
    const card = await client.memberCard.create({
      data: {
        participantId: owner.id,
        memberNumber,
        levelCode: owner.levelCode,
        provinceCode: owner.provinceCode,
        regencyCode: owner.regencyCode,
        isManual: input.isManual ?? isManual,
        isActive: true,
      },
      select,
    });
    await client.participant.update({
      where: { id: owner.id },
      data: { memberNumber, memberNumberIssuedAt: now },
    });
    return { ok: true as const, card };
  };

  try {
    // Caller yang sudah membuka transaksi (penerbitan pertama via issueKta)
    // meneruskan client-nya supaya semuanya satu atom.
    return tx ? await run(tx) : await prisma.$transaction(run);
  } catch (err) {
    if (isUniqueViolation(err)) {
      return fail(409, "CONFLICT", "Nomor anggota itu sudah dipakai kartu lain.");
    }
    logRouteError("POST member card issue", err);
    return fail(503, "SERVER_ERROR", "Layanan sedang tidak tersedia. Coba lagi nanti.");
  }
}

/** Jadikan satu kartu aktif. Kartu lain di-retire, cermin peserta ikut berubah. */
export async function activateMemberCard(
  participantId: bigint,
  cardId: bigint,
): Promise<{ ok: true; card: MemberCardRow } | MemberCardError> {
  try {
    return await prisma.$transaction(async (tx) => {
      const card = await tx.memberCard.findFirst({
        where: { id: cardId, participantId },
        select,
      });
      if (!card) return fail(404, "NOT_FOUND", "Kartu tidak ditemukan untuk peserta ini.");

      const now = new Date();
      await tx.memberCard.updateMany({
        where: { participantId, isActive: true, id: { not: cardId } },
        data: { isActive: false, retiredAt: now },
      });
      const updated = await tx.memberCard.update({
        where: { id: cardId },
        data: { isActive: true, retiredAt: null },
        select,
      });
      await tx.participant.update({
        where: { id: participantId },
        data: { memberNumber: updated.memberNumber, memberNumberIssuedAt: updated.issuedAt },
      });
      return { ok: true as const, card: updated };
    });
  } catch (err) {
    logRouteError("POST member card activate", err);
    return fail(503, "SERVER_ERROR", "Layanan sedang tidak tersedia. Coba lagi nanti.");
  }
}

/**
 * Cari kartu pemilik sebuah nomor, aktif maupun sudah diganti. Dipakai halaman
 * verifikasi: nomor lama harus tetap mengarah ke orangnya, bukan 404.
 */
export async function resolveMemberCard(memberNumber: string) {
  return prisma.memberCard.findUnique({
    where: { memberNumber },
    select: {
      participantId: true,
      memberNumber: true,
      isActive: true,
    },
  });
}

/**
 * Nomor kartu aktif milik peserta. `null` = peserta belum punya kartu.
 * Sumber tunggal untuk halaman verifikasi; jangan baca `participants.member_number`
 * langsung di sana.
 */
export async function getActiveMemberNumber(participantId: bigint): Promise<string | null> {
  const card = await prisma.memberCard.findFirst({
    where: { participantId, isActive: true },
    select: { memberNumber: true },
  });
  return card?.memberNumber ?? null;
}

/**
 * Backfill kartu untuk peserta yang sudah punya nomor sebelum tabel
 * `member_cards` ada. Idempoten: baris yang sudah ada dilewati.
 * Jalankan sekali setelah migrate.
 */
export async function backfillMemberCards(): Promise<{ created: number; skipped: number }> {
  const rows = await prisma.participant.findMany({
    where: { memberNumber: { not: null } },
    select: {
      id: true,
      memberNumber: true,
      levelCode: true,
      provinceCode: true,
      regencyCode: true,
      memberNumberIssuedAt: true,
      createdAt: true,
    },
  });
  const existing = new Set(
    (await prisma.memberCard.findMany({ select: { memberNumber: true } })).map((c) => c.memberNumber),
  );

  let created = 0;
  let skipped = 0;
  for (const r of rows) {
    // Wilayah wajib (kolom NOT NULL di member_cards); peserta lama tanpa wilayah dilewati.
    if (!r.memberNumber || !r.provinceCode || !r.regencyCode) {
      skipped++;
      continue;
    }
    if (existing.has(r.memberNumber)) {
      skipped++;
      continue;
    }
    await prisma.memberCard.create({
      data: {
        participantId: r.id,
        memberNumber: r.memberNumber,
        levelCode: r.levelCode,
        provinceCode: r.provinceCode,
        regencyCode: r.regencyCode,
        issuedAt: r.memberNumberIssuedAt ?? r.createdAt,
        isActive: true,
      },
    });
    created++;
  }
  return { created, skipped };
}
