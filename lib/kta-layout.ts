/**
 * Koordinat slot kartu KTA, satu sumber kebenaran.
 * Dipakai lab koordinat (`components/KtaCoordLab.tsx`) dan kartu final
 * (`components/KtaCardView.tsx`) supaya preview == hasil cetak.
 *
 * Satuan:
 * - x, y = persen dari kotak artwork (1050 × 600 px, rasio 1.75).
 * - w    = lebar blok dalam persen lebar kartu (1 = 1%).
 * - size = ukuran font dalam persen lebar kartu (1 = 1%).
 * - align "center": x adalah titik tengah blok (translateX(-50%)).
 *
 * Di kartu, `1em` = lebar kartu (`.kta-card { font-size: 85.6mm }`), jadi
 * persen di atas dikonversi ke em. Tidak memakai container query: `cqw`
 * jatuh ke 0 di beberapa renderer print, dan semua teks ikut hilang.
 */

export type KtaFace = "depan" | "belakang";
export type KtaAlign = "left" | "center";
export type KtaWeight = "bold" | "black";

export type KtaBox = {
  x: number;
  y: number;
  w: number;
  size: number;
  align: KtaAlign;
  weight?: KtaWeight;
};

export type KtaSlotKey =
  | "photo"
  | "memberNumber"
  | "fullName"
  | "levelLabel"
  | "qrVerifikasi";

export type KtaLayout = Record<KtaSlotKey, KtaBox>;

export const KTA_FACE_SRC: Record<KtaFace, string> = {
  depan: "/kta ikadi muka.png",
  belakang: "/id card belakang.svg",
};

export const KTA_FACE_LABEL: Record<KtaFace, string> = { depan: "Depan", belakang: "Belakang" };

export const KTA_SLOT_ORDER: KtaSlotKey[] = [
  "photo",
  "memberNumber",
  "fullName",
  "levelLabel",
  "qrVerifikasi",
];

export const KTA_SLOT_LABEL: Record<KtaSlotKey, string> = {
  photo: "Pas foto",
  memberNumber: "Nomor KTA",
  fullName: "Nama",
  levelLabel: "Level | wilayah | daerah",
  qrVerifikasi: "QR verifikasi",
};

/**
 * Angka final. Sumber: pemilik proyek (2026-11-15). QR verifikasi memakai
 * posisi yang dulu dipakai QR Ketum.
 */
export const KTA_LAYOUT: KtaLayout = {
  photo: { x: 6.44, y: 25.71, w: 17.8, size: 0, align: "left" },
  memberNumber: { x: 6.36, y: 71.4, w: 50, size: 4, align: "left" },
  fullName: { x: 6.44, y: 77.4, w: 72.2, size: 4, align: "left" },
  levelLabel: { x: 6.45, y: 85.58, w: 55, size: 2.25, align: "left" },
  qrVerifikasi: { x: 79.92, y: 66.59, w: 13.9, size: 0, align: "left" },
};

/**
 * Style posisi + lebar untuk WRAPPER slot.
 * `width` memakai `em`, dan em di sini dibaca dari font-size warisan
 * (`.kta-card { font-size: 85.6mm }` / container preview), BUKAN font-size
 * slot itu sendiri. Karena itu wrapper tidak boleh diberi `font-size` -
 * ukuran teks selalu di elemen anak (`fontStyle`).
 */
export function boxStyle(b: KtaBox): { left: string; top: string; width: string; transform?: string } {
  return {
    left: `${b.x}%`,
    top: `${b.y}%`,
    width: `${b.w / 100}em`,
    transform: b.align === "center" ? "translateX(-50%)" : undefined,
  };
}

/** Ukuran font slot, dipasang di elemen ANAK, bukan wrapper. 0 = tanpa teks. */
export function fontStyle(b: KtaBox, scale = 1): { fontSize: string } {
  return { fontSize: `${(b.size / 100) * scale}em` };
}
