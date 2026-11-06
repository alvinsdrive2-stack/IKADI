/**
 * Koordinat slot kartu KTA — satu sumber kebenaran.
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
  | "noteAuth"
  | "qrSekjen"
  | "sekjen"
  | "qrKetum"
  | "ketum";

export type KtaLayout = Record<KtaSlotKey, KtaBox>;

export const KTA_FACE_SRC: Record<KtaFace, string> = {
  depan: "/kta ikadi muka.png",
  belakang: "/kta ikadi belakang.png",
};

export const KTA_FACE_LABEL: Record<KtaFace, string> = { depan: "Depan", belakang: "Belakang" };

/** Teks bebas di blok bawah kartu. Bisa diganti per kartu lewat `KtaCardData.note`. */
export const KTA_NOTE_DEFAULT = "Terbit dan berlaku selama terdaftar sebagai anggota IKADI.";

export const KTA_SLOT_ORDER: KtaSlotKey[] = [
  "photo",
  "memberNumber",
  "fullName",
  "levelLabel",
  "noteAuth",
  "qrSekjen",
  "sekjen",
  "qrKetum",
  "ketum",
];

export const KTA_SLOT_LABEL: Record<KtaSlotKey, string> = {
  photo: "Pas foto",
  memberNumber: "Nomor KTA",
  fullName: "Nama",
  levelLabel: "Level | wilayah | daerah",
  noteAuth: "Teks bawah QR",
  qrSekjen: "QR Sekjen",
  sekjen: "TTD Sekjen",
  qrKetum: "QR Ketum",
  ketum: "TTD Ketum",
};

/** Angka final hasil lab koordinat. Jangan diubah tanpa menuning ulang lab. */
export const KTA_LAYOUT: KtaLayout = {
  photo: { x: 10.19, y: 26.78, w: 20, size: 0, align: "left" },
  memberNumber: { x: 34.63, y: 51.99, w: 50, size: 5, align: "left", weight: "black" },
  fullName: { x: 34.78, y: 29.65, w: 60, size: 4.2, align: "left" },
  levelLabel: { x: 34.73, y: 41.05, w: 55, size: 2.7, align: "left" },
  noteAuth: { x: 21.04, y: 75.99, w: 30, size: 1.35, align: "center" },
  qrSekjen: { x: 42.55, y: 71.27, w: 10, size: 0, align: "left" },
  sekjen: { x: 47.95, y: 90.53, w: 26, size: 1.6, align: "center" },
  qrKetum: { x: 73.48, y: 70.77, w: 10, size: 0, align: "left" },
  ketum: { x: 78.57, y: 90.53, w: 26, size: 1.6, align: "center" },
};

/**
 * Style posisi + lebar untuk WRAPPER slot.
 * `width` memakai `em`, dan em di sini dibaca dari font-size warisan
 * (`.kta-card { font-size: 85.6mm }` / container preview), BUKAN font-size
 * slot itu sendiri. Karena itu wrapper tidak boleh diberi `font-size` —
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

/** Ukuran font slot — dipasang di elemen ANAK, bukan wrapper. 0 = tanpa teks. */
export function fontStyle(b: KtaBox, scale = 1): { fontSize: string } {
  return { fontSize: `${(b.size / 100) * scale}em` };
}
