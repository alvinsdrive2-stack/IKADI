import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/http";
import { logRouteError } from "@/lib/route-log";
import { LEVEL_LABELS } from "@/lib/member-number";
import { activateMemberCard, issueMemberCard, listMemberCards } from "@/lib/member-cards";

type Ctx = { params: Promise<{ id: string }> };

const memberCardError = (r: { status: number; code: string; message: string }) =>
  jsonError(r.status, r.code, r.message);

/** GET — riwayat kartu + nomor aktif peserta. */
export async function readMemberCards(ctx: Ctx) {
  const { id: raw } = await ctx.params;
  if (!/^\d{1,20}$/.test(raw)) return jsonError(404, "NOT_FOUND", "Data peserta tidak ditemukan");

  try {
    const cards = await listMemberCards(BigInt(raw));
    return Response.json({
      ok: true,
      data: cards.map((c) => ({
        id: String(c.id),
        memberNumber: c.memberNumber,
        levelCode: c.levelCode,
        levelLabel: LEVEL_LABELS[c.levelCode] ?? "Anggota",
        issuedAt: c.issuedAt.toISOString(),
        isManual: c.isManual,
        isActive: c.isActive,
        retiredAt: c.retiredAt?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    logRouteError("GET member cards", err);
    return jsonError(503, "SERVER_ERROR", "Layanan sedang tidak tersedia. Coba lagi nanti.");
  }
}

/** POST — terbitkan kartu baru (otomatis atau nomor manual). Kartu baru aktif. */
export async function createMemberCard(ctx: Ctx, body: unknown) {
  const { id: raw } = await ctx.params;
  if (!/^\d{1,20}$/.test(raw)) return jsonError(404, "NOT_FOUND", "Data peserta tidak ditemukan");

  const b = (body ?? {}) as Record<string, unknown>;
  if (b.memberNumber !== undefined && b.memberNumber !== null && typeof b.memberNumber !== "string") {
    return jsonError(400, "VALIDATION", "Nomor anggota harus berupa teks.");
  }

  const r = await issueMemberCard({
    participantId: BigInt(raw),
    memberNumber:
      typeof b.memberNumber === "string" && b.memberNumber.trim() ? b.memberNumber : undefined,
  });
  if (!r.ok) return memberCardError(r);
  return Response.json({
    ok: true,
    data: {
      id: String(r.card.id),
      memberNumber: r.card.memberNumber,
      isManual: r.card.isManual,
      isActive: r.card.isActive,
      issuedAt: r.card.issuedAt.toISOString(),
    },
  });
}

/** POST activate — jadikan kartu tertentu aktif. */
export async function activateCard(ctx: Ctx, body: unknown) {
  const { id: raw } = await ctx.params;
  if (!/^\d{1,20}$/.test(raw)) return jsonError(404, "NOT_FOUND", "Data peserta tidak ditemukan");

  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.cardId !== "string" || !/^\d{1,20}$/.test(b.cardId)) {
    return jsonError(400, "VALIDATION", "cardId wajib diisi.");
  }

  const r = await activateMemberCard(BigInt(raw), BigInt(b.cardId));
  if (!r.ok) return memberCardError(r);
  return Response.json({
    ok: true,
    data: {
      id: String(r.card.id),
      memberNumber: r.card.memberNumber,
      isActive: r.card.isActive,
    },
  });
}

/** Ada/tidaknya peserta — dipakai route pengurus untuk cek cakupan sebelum aksi. */
export async function memberCardOwnerScope(raw: string) {
  if (!/^\d{1,20}$/.test(raw)) return "invalid" as const;
  try {
    const p = await prisma.participant.findUnique({
      where: { id: BigInt(raw) },
      select: { provinceCode: true, regencyCode: true, levelCode: true },
    });
    return p ?? "missing";
  } catch (err) {
    logRouteError("member cards owner scope", err);
    return "db_error" as const;
  }
}
