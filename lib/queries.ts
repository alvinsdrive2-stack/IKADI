import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { maskNik, maskWhatsapp } from "./mask";
import { LEVEL_LABELS } from "./member-number";

export const SORTS = ["newest", "oldest", "name_asc", "name_desc"] as const;
export type Sort = (typeof SORTS)[number];

export type ListParams = {
  q?: string;
  originType?: "PW" | "PD";
  originName?: string;
  education?: string;
  sermon?: "SERING" | "KADANG_KADANG" | "BELUM_PERNAH" | "LAINNYA";
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD
  sort?: Sort;
  page: number;
  perPage: number;
};

const orderBy: Record<Sort, Prisma.ParticipantOrderByWithRelationInput[]> = {
  newest: [{ createdAt: "desc" }, { id: "desc" }],
  oldest: [{ createdAt: "asc" }, { id: "asc" }],
  name_asc: [{ fullName: "asc" }],
  name_desc: [{ fullName: "desc" }],
};

function where(p: ListParams): Prisma.ParticipantWhereInput {
  const and: Prisma.ParticipantWhereInput[] = [];
  const q = p.q?.trim();
  if (q) {
    // Numeric-looking queries can match NIK/WA. Dotted digit strings ("6.16.01",
    // "6.16.01.26.0001") search member_number — admin copy-pastes the number.
    const numeric = /^[0-9+]+$/.test(q);
    const memberLike = /^[1-7](\.[0-9]{1,4}){1,4}$/.test(q);
    and.push({
      OR: [
        { fullName: { contains: q } },
        ...(numeric ? [{ nik: { contains: q } }, { whatsapp: { contains: q } }] : []),
        ...(memberLike ? [{ memberNumber: { contains: q } }] : []),
      ],
    });
  }
  if (p.originType) and.push({ originType: p.originType });
  if (p.originName) and.push({ originName: { contains: p.originName } });
  if (p.education) and.push({ lastEducation: p.education });
  if (p.sermon) and.push({ sermonExperience: p.sermon });
  if (p.dateFrom || p.dateTo) {
    const range: Prisma.DateTimeFilter = {};
    if (p.dateFrom) range.gte = new Date(`${p.dateFrom}T00:00:00`);
    if (p.dateTo) range.lt = new Date(new Date(`${p.dateTo}T00:00:00`).getTime() + 86_400_000);
    and.push({ createdAt: range });
  }
  return and.length ? { AND: and } : {};
}

/** List row for admin table: full NIK/WA never leave the server, only masked values. */
export async function listParticipants(p: ListParams) {
  const listWhere = where(p);
  const [rows, total] = await Promise.all([
    prisma.participant.findMany({
      where: listWhere,
      orderBy: orderBy[p.sort ?? "newest"],
      skip: (p.page - 1) * p.perPage,
      take: p.perPage,
      select: {
        id: true,
        createdAt: true,
        fullName: true,
        nik: true,
        originType: true,
        originName: true,
        whatsapp: true,
        lastEducation: true,
        memberNumber: true,
        levelCode: true,
      },
    }),
    prisma.participant.count({ where: listWhere }),
  ]);

  return {
    data: rows.map((r) => ({
      id: String(r.id),
      createdAt: r.createdAt.toISOString(),
      fullName: r.fullName,
      nikMasked: maskNik(r.nik),
      originType: r.originType,
      originName: r.originName,
      whatsappMasked: maskWhatsapp(r.whatsapp),
      lastEducation: r.lastEducation,
      memberNumber: r.memberNumber,
      levelCode: r.levelCode,
      levelLabel: LEVEL_LABELS[r.levelCode] ?? "Anggota",
    })),
    total,
    page: p.page,
    perPage: p.perPage,
    totalPages: Math.max(1, Math.ceil(total / p.perPage)),
  };
}

/**
 * Detail peserta untuk halaman admin. `passwordHash` sengaja dibuang —
 * tidak ada UI admin yang membutuhkannya, dan mengirimkannya ke browser
 * berarti hash argon2id ikut ke devtools/log proxy.
 */
export async function getParticipant(id: bigint) {
  const r = await prisma.participant.findUnique({ where: { id } });
  if (!r) return null;
  const { passwordHash, ...safe } = r;
  return {
    ...safe,
    id: String(r.id),
    birthDate: r.birthDate.toISOString().slice(0, 10),
    // Boolean, bukan hash: admin cuma perlu tahu sudah punya sandi atau belum.
    hasPassword: !!passwordHash,
    levelLabel: LEVEL_LABELS[r.levelCode] ?? "Anggota",
  };
}

/** Path relatif pas foto (mis. "uploads/participants/12.jpg") atau null. */
export async function getParticipantPhotoPath(id: bigint) {
  const r = await prisma.participant.findUnique({ where: { id }, select: { photoPath: true } });
  return r?.photoPath ?? null;
}

/** Path relatif foto KTP (mis. "ktp/12.jpg") atau null. */
export async function getParticipantKtpPath(id: bigint) {
  const r = await prisma.participant.findUnique({ where: { id }, select: { ktpPath: true } });
  return r?.ktpPath ?? null;
}

export async function getStats() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const ktaPrintLimit = Number(process.env.KTA_PRINT_LIMIT ?? 10);
  const [total, pw, pd, today, ktaPrinted] = await Promise.all([
    prisma.participant.count(),
    prisma.participant.count({ where: { originType: "PW" } }),
    prisma.participant.count({ where: { originType: "PD" } }),
    prisma.participant.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.ktaPrint.count(),
  ]);
  return {
    total,
    pw,
    pd,
    today,
    kta: {
      printed: ktaPrinted,
      limit: ktaPrintLimit,
      remaining: Math.max(0, ktaPrintLimit - ktaPrinted),
    },
  };
}

/**
 * Data yang boleh tampil di halaman verifikasi publik (`/verifikasi/:nomor`).
 * Proyeksi sengaja sempit: NIK, alamat, WhatsApp, path KTP, hash sandi, dan id
 * internal tidak pernah ikut terambil — bukan cuma disembunyikan di render.
 */
export async function getMemberCard(memberNumber: string) {
  const r = await prisma.participant.findUnique({
    where: { memberNumber },
    select: {
      fullName: true,
      memberNumber: true,
      memberNumberIssuedAt: true,
      createdAt: true,
      levelCode: true,
      originType: true,
      originName: true,
      membershipStatus: true,
      provinceCode: true,
      regencyCode: true,
    },
  });
  if (!r) return null;

  const [prov, reg] = await Promise.all([
    r.provinceCode
      ? prisma.province.findUnique({ where: { code: r.provinceCode }, select: { name: true } })
      : null,
    r.provinceCode && r.regencyCode
      ? prisma.regency.findUnique({
          where: {
            provinceCode_code: { provinceCode: r.provinceCode, code: r.regencyCode },
          },
          select: { name: true },
        })
      : null,
  ]);

  return {
    fullName: r.fullName,
    memberNumber: r.memberNumber!,
    memberNumberIssuedAt: r.memberNumberIssuedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    levelLabel: LEVEL_LABELS[r.levelCode] ?? "Anggota",
    originType: r.originType,
    originName: r.originName,
    membershipStatus: r.membershipStatus,
    provinceName: prov?.name ?? null,
    regencyName: reg?.name ?? null,
  };
}

export async function getEducationOptions() {
  const rows = await prisma.participant.findMany({
    where: { lastEducation: { not: null } },
    distinct: ["lastEducation"],
    select: { lastEducation: true },
    orderBy: { lastEducation: "asc" },
  });
  return rows.map((r) => r.lastEducation).filter((v): v is string => !!v);
}
