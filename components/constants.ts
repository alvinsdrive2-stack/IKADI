export const EDUCATION_OPTIONS = [
  "SD/Sederajat",
  "SMP/Sederajat",
  "SMA/SMK/Sederajat",
  "D1/D2/D3",
  "D4/S1",
  "S2",
  "S3",
  "Lainnya",
] as const;

export const SERMON_LABELS: Record<string, string> = {
  SERING: "Sering",
  KADANG_KADANG: "Kadang-Kadang",
  BELUM_PERNAH: "Belum Pernah",
  LAINNYA: "Lainnya",
};

export const QURAN_LABELS: Record<string, string> = {
  TAJWID_BAIK: "Baik Sesuai Hukum Tajwid",
  BIASA: "Biasa Saja",
  TIDAK_LANCAR: "Tidak Lancar",
};

export const formatDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
};

export const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
};
