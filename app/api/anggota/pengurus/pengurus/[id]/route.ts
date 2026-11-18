import { prisma } from "@/lib/prisma";
import { requirePengurus } from "@/lib/auth";
import { LEVEL_LABELS } from "@/lib/member-number";
import {
  appointBlocker,
  appointableLevels,
  canManage,
  inScope,
  PENGURUS_MIN_LEVEL,
  PENGURUS_MAX_LEVEL,
} from "@/lib/pengurus";
import { jsonError } from "@/lib/http";
import { logRouteError } from "@/lib/route-log";

const SELECT = {
  id: true,
  fullName: true,
  levelCode: true,
  provinceCode: true,
  regencyCode: true,
  memberNumber: true,
  isPengurus: true,
} as const;

/**
 * PATCH /api/anggota/pengurus/pengurus/[id], lantik / cabut peran pengurus.
 * Body: `{ isPengurus: boolean, levelCode?: number }`.
 *
 * Melantik: levelCode wajib 1..3 dan dalam `appointableLevels(actor)`; target
 * harus lolos `canManage` (bukan diri sendiri, level & wilayah cocok) dan tidak
 * kena `appointBlocker` (mis. nomor anggota sudah terbit).
 * Mencabut: cukup `canManage`; levelCode tidak diubah.
 */
export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requirePengurus();
  if (!auth.ok) return auth.response;
  const actor = auth.actor;

  const { id: raw } = await ctx.params;
  if (!/^\d{1,20}$/.test(raw)) return jsonError(404, "NOT_FOUND", "Data peserta tidak ditemukan");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "VALIDATION", "Body harus JSON valid");
  }
  const b = (body ?? {}) as Record<string, unknown>;

  if (typeof b.isPengurus !== "boolean") {
    return jsonError(400, "VALIDATION", "Field isPengurus harus boolean (true untuk melantik, false untuk mencabut).");
  }

  let levelCode: number | undefined;
  if (b.isPengurus) {
    if (
      typeof b.levelCode !== "number" ||
      !Number.isInteger(b.levelCode) ||
      b.levelCode < PENGURUS_MIN_LEVEL ||
      b.levelCode > PENGURUS_MAX_LEVEL
    ) {
      return jsonError(400, "VALIDATION", "Melantik pengurus wajib menyertakan levelCode 1..3.");
    }
    levelCode = b.levelCode;
  }

  let target;
  try {
    target = await prisma.participant.findUnique({ where: { id: BigInt(raw) }, select: SELECT });
  } catch (err) {
    logRouteError("PATCH /api/anggota/pengurus/pengurus/[id] load", err);
    return jsonError(503, "SERVER_ERROR", "Layanan sedang tidak tersedia. Coba lagi nanti.");
  }
  // Luar cakupan = 404 (sama seperti tidak ada) supaya keberadaan tidak bocor.
  if (!target || !inScope(actor, target)) {
    return jsonError(404, "NOT_FOUND", "Data peserta tidak ditemukan");
  }

  const targetArg = {
    participantId: String(target.id),
    levelCode: target.levelCode,
    provinceCode: target.provinceCode,
    regencyCode: target.regencyCode,
  };

  if (b.isPengurus) {
    // --- Melantik ---
    if (!appointableLevels(actor).includes(levelCode!)) {
      return jsonError(
        403,
        "FORBIDDEN",
        `Level ${actor.levelCode} hanya bisa mengangkat level ${appointableLevels(actor).join("/")}.`,
      );
    }
    // Blocker (nomor terbit / wilayah kosong) menjelaskan lebih spesifik daripada
    // pesan level, jadi diperiksa lebih dulu.
    const blocker = appointBlocker(target);
    if (blocker) {
      return jsonError(409, "BLOCKED", blocker);
    }
    // Peserta level 6 dilantik dengan level baru -> yang dinilai adalah level
    // SESUDAH lantik, bukan level lamanya.
    const manage = canManage(actor, { ...targetArg, levelCode: levelCode! });
    if (!manage.ok) {
      return jsonError(403, "FORBIDDEN", manage.reason);
    }
  } else {
    // --- Mencabut ---
    if (!target.isPengurus) {
      return jsonError(409, "BLOCKED", "Peserta ini bukan pengurus.");
    }
    const manage = canManage(actor, targetArg);
    if (!manage.ok) {
      return jsonError(403, "FORBIDDEN", manage.reason);
    }
  }

  try {
    const updated = await prisma.participant.update({
      where: { id: target.id },
      // Mencabut tidak mengubah level, level hanya berubah saat melantik.
      data: b.isPengurus ? { isPengurus: true, levelCode: levelCode! } : { isPengurus: false },
      select: SELECT,
    });
    return Response.json({
      ok: true,
      data: {
        id: String(updated.id),
        fullName: updated.fullName,
        isPengurus: updated.isPengurus,
        levelCode: updated.levelCode,
        levelLabel: LEVEL_LABELS[updated.levelCode] ?? "Anggota",
        memberNumber: updated.memberNumber,
      },
    });
  } catch (err) {
    logRouteError("PATCH /api/anggota/pengurus/pengurus/[id] update", err);
    return jsonError(503, "SERVER_ERROR", "Layanan sedang tidak tersedia. Coba lagi nanti.");
  }
}
