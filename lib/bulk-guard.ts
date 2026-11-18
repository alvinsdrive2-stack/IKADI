/**
 * Validasi masukan bersama untuk endpoint ekspor/penerbitan massal —
 * dipakai area admin dan area pengurus supaya aturan id sama.
 */
import { listParticipantIds } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/http";

export type BulkSelection = string[] | { all: true };

export function parseIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  if (value.length === 0) return [];
  const ids: string[] = [];
  for (const v of value) {
    if (typeof v !== "string" || !/^\d{1,20}$/.test(v)) return null;
    ids.push(v);
  }
  // Batas praktis: satu ZIP berisi ribuan kartu akan menghabiskan memori.
  return ids.slice(0, 500);
}

export function parseKind(value: unknown): "pdf" | "jpg" | null {
  return value === "pdf" || value === "jpg" ? value : null;
}

/**
 * Daftar id final untuk pekerjaan massal. `all` berarti seluruh hasil filter
 * yang sedang aktif di tabel, bukan hanya halaman yang tampil.
 */
export async function resolveIds(
  selection: BulkSelection,
  filter: Omit<Parameters<typeof listParticipantIds>[0], "scopeWhere">,
  scopeWhere?: Parameters<typeof listParticipantIds>[0]["scopeWhere"],
): Promise<string[]> {
  if (Array.isArray(selection)) return selection;
  return listParticipantIds({ ...filter, scopeWhere });
}

/** Pastikan semua id ada dan (untuk pengurus) di dalam cakupan. */
export async function filterExisting(
  ids: string[],
  where?: { provinceCode?: string | null; regencyCode?: string | null },
): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.participant.findMany({
    where: { id: { in: ids.map((i) => BigInt(i)) }, ...(where ?? {}) },
    select: { id: true },
  });
  const ok = new Set(rows.map((r) => String(r.id)));
  return ids.filter((i) => ok.has(i));
}

export const bulkError = (status: number, message: string) => jsonError(status, "VALIDATION", message);
