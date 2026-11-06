import { prisma } from "@/lib/prisma";

export type KtaPejabat = { nama: string; jabatan: string };
export type KtaKey = "ketuaUmum" | "sekjen";
export type KtaPejabatMap = { ketuaUmum: KtaPejabat; sekjen: KtaPejabat };

/**
 * Warna QR: modul hijau (primary #04A94B digelapkan sedikit → #037A37),
 * latar transparan supaya artwork kartu tembus — bukan kotak putih.
 * Format #RRGGBBAA; `qrcode` menerima alpha di dua digit terakhir.
 */
export const KTA_QR_COLOR = { dark: "#037A37FF", light: "#00000000" } as const;

export const KTA_KEYS: KtaKey[] = ["ketuaUmum", "sekjen"];

/** Label jabatan default kalau kolom `jabatan` kosong di DB. */
export const KTA_JABATAN_DEFAULT: Record<KtaKey, string> = {
  ketuaUmum: "Ketua Umum",
  sekjen: "Sekretaris Jenderal",
};

/** Fallback env (kompatibel dengan .env lama) saat DB belum punya baris. */
const ENV_DEFAULT: Record<KtaKey, string | undefined> = {
  ketuaUmum: process.env.KTA_KETUA_UMUM,
  sekjen: process.env.KTA_SEKRETARIS_JENDERAL,
};

function fallback(key: KtaKey): KtaPejabat {
  const nama = ENV_DEFAULT[key]?.trim() || KTA_JABATAN_DEFAULT[key];
  return { nama, jabatan: KTA_JABATAN_DEFAULT[key] };
}

function fromRows(rows: { key: string; nama: string; jabatan: string }[] | null): KtaPejabatMap {
  const out: KtaPejabatMap = { ketuaUmum: fallback("ketuaUmum"), sekjen: fallback("sekjen") };
  for (const row of rows ?? []) {
    if (row.key !== "ketuaUmum" && row.key !== "sekjen") continue;
    out[row.key] = {
      nama: row.nama.trim() || fallback(row.key).nama,
      jabatan: row.jabatan.trim() || KTA_JABATAN_DEFAULT[row.key],
    };
  }
  return out;
}

/**
 * Nama pejabat untuk blok tanda tangan KTA.
 * Sumber utama tabel `kta_officials`; DB error / tabel belum migrate → env.
 * Sengaja tidak pernah throw: halaman verifikasi publik harus tetap tampil.
 */
export async function getPejabat(): Promise<KtaPejabatMap> {
  try {
    const rows = await prisma.ktaOfficial.findMany({
      select: { key: true, nama: true, jabatan: true },
    });
    return fromRows(rows);
  } catch {
    return fromRows(null);
  }
}

/** Versi murni tanpa DB — dipakai tes & saat render server tanpa koneksi. */
export function getPejabatFallback(): KtaPejabatMap {
  return fromRows(null);
}
