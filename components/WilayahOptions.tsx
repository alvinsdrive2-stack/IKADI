import { PROVINCES, REGENCIES } from "@/lib/wilayah";

export { LEVEL_LABELS } from "@/lib/member-number";

export type Option = { value: string; label: string; disabled?: boolean };

/** Opsi provinsi — placeholder di index 0 (value ""), value = kode 2 digit. */
export const PROVINCE_OPTIONS: Option[] = [
  { value: "", label: "Pilih provinsi", disabled: true },
  ...PROVINCES.map((p) => ({ value: p.code, label: p.name })),
];

/** Opsi kabupaten/kota untuk satu provinsi. Belum pilih provinsi -> kosong & disabled. */
export function regencyOptions(provinceCode: string): Option[] {
  if (!provinceCode) {
    return [{ value: "", label: "Pilih provinsi dulu", disabled: true }];
  }
  const rows = REGENCIES.filter((r) => r.provinceCode === provinceCode);
  return [
    { value: "", label: "Pilih kabupaten/kota", disabled: true },
    ...rows.map((r) => ({ value: r.code, label: r.name })),
  ];
}

/** Nama provinsi dari kode (untuk pratinjau read-only). */
export const provinceName = (code: string | null) =>
  code ? PROVINCES.find((p) => p.code === code)?.name ?? null : null;

/** Nama kabupaten/kota dari kode (butuh provinsi supaya kode 2 digit unik). */
export const regencyName = (provinceCode: string | null, code: string | null) => {
  if (!provinceCode || !code) return null;
  return REGENCIES.find((r) => r.provinceCode === provinceCode && r.code === code)?.name ?? null;
};
