/**
 * Parameter filter daftar peserta yang dipakai bersama endpoint admin dan
 * pengurus, supaya keduanya tidak berbeda tafsir.
 */

const LEVELS = [1, 2, 3, 4, 5, 6, 7];

/** `level` kosong = tanpa filter; nilai di luar 1..7 diabaikan, bukan error. */
export function levelParam(sp: URLSearchParams): number | undefined {
  const raw = sp.get("level")?.trim();
  if (!raw) return undefined;
  const n = Number(raw);
  return LEVELS.includes(n) ? n : undefined;
}

/**
 * `source` kosong = tanpa filter. "mandiri" = peserta tanpa sumber data.
 * Angka = `data_sources.id`; nilai aneh diabaikan supaya query tetap jalan.
 */
export function sourceParam(sp: URLSearchParams): string | undefined {
  const raw = sp.get("source")?.trim();
  if (!raw) return undefined;
  if (raw === "mandiri") return raw;
  return /^\d{1,10}$/.test(raw) ? raw : undefined;
}
