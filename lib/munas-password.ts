/**
 * Aturan sandi untuk peserta hasil impor MUNAS.
 *
 * Format: `Munas` + DDMMYY dari digit 7..12 NIK.
 * Contoh: NIK 3273010101900001 -> `Munas010190`.
 *
 * Sumber tanggal lahir di data MUNAS tidak ada, jadi NIK satu-satunya acuan.
 * Kalau tanggalnya mustahil (bulan > 12), pemanggil wajib memakai sandi default
 * dan membiarkan peserta menggantinya saat melengkapi profil.
 */

/** Sandi cadangan saat tanggal lahir tidak bisa diturunkan dari NIK. */
export const MUNAS_DEFAULT_PASSWORD = "Munas@IKADI2026";

export type DerivedPassword =
  | { ok: true; password: string; day: number; month: number; year2: number }
  | { ok: false; reason: string };

/**
 * Ambil DDMMYY dari NIK 16 digit. Tidak menebak abad: yang dipakai hanya dua
 * digit tahun seperti tertulis di NIK.
 */
export function passwordFromNik(nik: string): DerivedPassword {
  if (!/^\d{16}$/.test(nik)) return { ok: false, reason: "NIK bukan 16 digit" };

  const day = Number(nik.slice(6, 8));
  const month = Number(nik.slice(8, 10));
  const year2 = Number(nik.slice(10, 12));

  if (day < 1 || day > 31) return { ok: false, reason: "Tanggal di NIK tidak valid" };
  if (month < 1 || month > 12) return { ok: false, reason: "Bulan di NIK tidak valid" };

  const dd = String(day).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  const yy = String(year2).padStart(2, "0");
  return { ok: true, password: `Munas${dd}${mm}${yy}`, day, month, year2 };
}

/**
 * Tanggal lahir untuk kolom `birth_date`. Abad tidak bisa dipastikan dari NIK,
 * jadi dipakai aturan tambahan yang dapat dipertanggungjawabkan: kalau dua
 * digit tahun lebih besar dari tahun berjalan (mod 100), dianggap abad lalu.
 * Contoh pada 2026: `90` -> 1990, `05` -> 2005.
 */
export function birthDateFromNik(nik: string, currentYear: number): Date | null {
  const p = passwordFromNik(nik);
  if (!p.ok) return null;
  const currentYy = currentYear % 100;
  const century = p.year2 > currentYy ? 1900 : 2000;
  const year = century + p.year2;
  const date = new Date(Date.UTC(year, p.month - 1, p.day));
  // Tolak tanggal yang meluap (mis. 31 Februari).
  if (date.getUTCDate() !== p.day || date.getUTCMonth() !== p.month - 1) return null;
  return date;
}
