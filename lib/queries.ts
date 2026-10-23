import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { maskNik, maskWhatsapp } from "./mask";

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
    // Only numeric-looking queries can match NIK/WA; everything else matches name only.
    const numeric = /^[0-9+]+$/.test(q);
    and.push({
      OR: [
        { fullName: { contains: q } },
        ...(numeric ? [{ nik: { contains: q } }, { whatsapp: { contains: q } }] : []),
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
    })),
    total,
    page: p.page,
    perPage: p.perPage,
    totalPages: Math.max(1, Math.ceil(total / p.perPage)),
  };
}

export async function getParticipant(id: bigint) {
  const r = await prisma.participant.findUnique({ where: { id } });
  if (!r) return null;
  return { ...r, id: String(r.id), birthDate: r.birthDate.toISOString().slice(0, 10) };
}

export async function getStats() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const [total, pw, pd, today] = await Promise.all([
    prisma.participant.count(),
    prisma.participant.count({ where: { originType: "PW" } }),
    prisma.participant.count({ where: { originType: "PD" } }),
    prisma.participant.count({ where: { createdAt: { gte: startOfDay } } }),
  ]);
  return { total, pw, pd, today };
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
