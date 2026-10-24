import { z } from "zod";

const stripQuoteAndTrim = (v: unknown) => {
  if (typeof v !== "string") return v;
  const t = v.trim();
  return t.startsWith("'") ? t.slice(1).trim() : t;
};

export const normalizeNik = stripQuoteAndTrim;
export const normalizeWhatsapp = stripQuoteAndTrim;

const nikSchema = z.preprocess(
  normalizeNik,
  z
    .string({ error: "NIK wajib diisi" })
    .regex(/^[0-9]{16}$/, "NIK harus tepat 16 digit angka"),
);

const whatsappSchema = z.preprocess(
  normalizeWhatsapp,
  z
    .string({ error: "Nomor WhatsApp wajib diisi" })
    .regex(/^(\+62|62|0)8[0-9]{7,13}$/, "Nomor WhatsApp tidak valid"),
);

const requiredText = (label: string, max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z
      .string({ error: `${label} wajib diisi` })
      .min(1, `${label} wajib diisi`)
      .max(max, `${label} maksimal ${max} karakter`),
  );

const optionalText = (max: number, label: string) =>
  z.preprocess(
    (v) => {
      if (typeof v !== "string") return undefined;
      const t = v.trim();
      return t === "" ? undefined : t;
    },
    z.string().max(max, `${label} maksimal ${max} karakter`).optional(),
  );

/** Pas foto: base64 dari <input type=file>, maks 1 MB. Ekstensi divalidasi dari magic bytes server. */
export const PHOTO_MAX_BYTES = 1024 * 1024;

const photoSchema = z
  .string({ error: "Pas foto wajib diunggah" })
  .refine((s) => /^data:image\/(jpeg|png|webp);base64,/.test(s), "Pas foto harus JPEG, PNG, atau WebP")
  .refine((s) => s.length * 0.75 <= PHOTO_MAX_BYTES, "Ukuran pas foto maksimal 1 MB")
  .transform((s) => s.slice(s.indexOf(",") + 1));

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// ponytail: birthDate future check uses server-local date; upgrade to Asia/Jakarta if server TZ differs.
const birthDateSchema = z
  .string({ error: "Tanggal lahir wajib diisi" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "Tanggal lahir tidak valid")
  .refine((s) => s <= todayIso(), "Tanggal lahir tidak boleh di masa depan");

export const participantSchema = z
  .object({
    originType: z.enum(["PW", "PD"], { error: "Asal IKADI wajib dipilih" }),
    originName: requiredText("Nama PW/PD IKADI", 150),
    fullName: requiredText("Nama lengkap", 200),
    nik: nikSchema,
    birthPlace: requiredText("Tempat lahir", 120),
    birthDate: birthDateSchema,
    gender: z.enum(["LAKI_LAKI", "PEREMPUAN"], { error: "Jenis kelamin wajib dipilih" }),
    photo: photoSchema,
    address: requiredText("Alamat", 5000),
    whatsapp: whatsappSchema,
    lastEducation: optionalText(100, "Pendidikan terakhir"),
    occupation: requiredText("Pekerjaan", 150),
    expertise: optionalText(5000, "Bidang keahlian"),
    sermonExperience: z.enum(
      ["SERING", "KADANG_KADANG", "BELUM_PERNAH", "LAINNYA"],
      { error: "Pengalaman khutbah wajib dipilih" },
    ),
    sermonExperienceOther: optionalText(200, "Keterangan pengalaman khutbah"),
    organizationExperience: optionalText(5000, "Pengalaman organisasi"),
    quranReading: z.enum(["TAJWID_BAIK", "BIASA", "TIDAK_LANCAR"], {
      error: "Kemampuan membaca Al Qur'an wajib dipilih",
    }),
    trainingReason: requiredText("Alasan mengikuti pelatihan", 5000),
    trainingExpectation: requiredText("Harapan setelah pelatihan", 5000),
    consent: z.literal(true, { error: "Persetujuan wajib dicentang" }),
  })
  .superRefine((v, ctx) => {
    if (v.sermonExperience === "LAINNYA" && !v.sermonExperienceOther) {
      ctx.addIssue({
        code: "custom",
        path: ["sermonExperienceOther"],
        message: "Keterangan wajib diisi jika memilih Lainnya",
      });
    }
  })
  .transform((v) => ({
    ...v,
    sermonExperienceOther:
      v.sermonExperience === "LAINNYA" ? v.sermonExperienceOther : undefined,
  }));

export type ParticipantInput = z.input<typeof participantSchema>;
export type ParticipantData = z.output<typeof participantSchema>;

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Username wajib diisi").max(100),
  password: z.string().min(1, "Password wajib diisi").max(200),
});
