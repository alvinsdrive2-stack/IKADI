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

/** Pas foto: base64 dari <input type=file>, opsional, maks 1 MB. Ekstensi divalidasi dari magic bytes server. */
export const PHOTO_MAX_BYTES = 1024 * 1024;

/** Foto KTP: base64, WAJIB hanya untuk jalur upload (OCR). Jalur manual opsional, tapi kalau diisi tetap divalidasi. Maks 10 MB. */
export const KTP_MAX_BYTES = 10 * 1024 * 1024;

/** Validator data URL gambar, dipakai form pendaftaran dan endpoint ganti pas foto. */
export const dataUrlImage = (label: string, maxBytes: number, maxLabel: string) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? v : undefined),
    z
      .string({ error: `${label} harus JPEG, PNG, atau WebP` })
      .refine((s) => /^data:image\/(jpeg|png|webp);base64,/.test(s), `${label} harus JPEG, PNG, atau WebP`)
      .refine((s) => s.length * 0.75 <= maxBytes, `Ukuran ${maxLabel} maksimal ${maxBytes / (1024 * 1024)} MB`)
      .optional(),
  );

const photoSchema = dataUrlImage("Pas foto", PHOTO_MAX_BYTES, "pas foto");
// KTP opsional di schema. Form jalur upload mewajibkannya sendiri (rootChoice upload);
// route menerima kosong = peserta tanpa foto KTP. Terisi = harus data URL gambar valid.
const ktpSchema = dataUrlImage("Foto KTP", KTP_MAX_BYTES, "foto KTP");

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

/** Teks bebas yang disimpan apa adanya: trim + kapital seluruhnya. */
const requiredUpper = (label: string, max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLocaleUpperCase("id-ID") : v),
    z
      .string({ error: `${label} wajib diisi` })
      .min(1, `${label} wajib diisi`)
      .max(max, `${label} maksimal ${max} karakter`),
  );

export const participantSchema = z
  .object({
    fullName: requiredUpper("Nama lengkap", 200),
    nik: nikSchema,
    birthPlace: requiredUpper("Tempat lahir", 120),
    birthDate: birthDateSchema,
    gender: z.enum(["LAKI_LAKI", "PEREMPUAN"], { error: "Jenis kelamin wajib dipilih" }),
    maritalStatus: z.enum(["BELUM_MENIKAH", "SUDAH_MENIKAH", "CERAI_HIDUP", "CERAI_MATI"], {
      error: "Status pernikahan wajib dipilih",
    }),
    bloodType: z.enum(["A", "B", "AB", "O", "TIDAK_TAHU"], {
      error: "Golongan darah wajib dipilih",
    }),
    photo: photoSchema,
    ktp: ktpSchema,
    // Kolom lama; diisi otomatis dari addressCurrent/addressKtp di route (kompatibilitas admin & laporan).
    address: optionalText(5000, "Alamat"),
    addressKtp: requiredText("Alamat sesuai KTP", 5000),
    addressCurrent: optionalText(5000, "Alamat tinggal saat ini"),
    addressSameAsKtp: z.preprocess(
      (v) => (typeof v === "boolean" ? v : false),
      z.boolean(),
    ),
    province: requiredText("Provinsi", 100),
    city: requiredText("Kabupaten/Kota", 100),
    whatsapp: whatsappSchema,
    lastEducation: optionalText(100, "Pendidikan terakhir"),
    studyField: optionalText(150, "Bidang studi"),
    occupation: requiredText("Pekerjaan", 150),
    expertise: optionalText(5000, "Bidang keahlian"),
    consent: z.literal(true, { error: "Persetujuan wajib dicentang" }),
  })
  .superRefine((v, ctx) => {
    if (!v.addressSameAsKtp && !v.addressCurrent) {
      ctx.addIssue({
        code: "custom",
        path: ["addressCurrent"],
        message: "Alamat tinggal wajib diisi jika berbeda dengan alamat KTP",
      });
    }
  })
  .transform((v) => ({
    ...v,
    // Dicentang "sesuai KTP" -> alamat tinggal selalu sama dengan alamat KTP.
    addressCurrent: v.addressSameAsKtp ? v.addressKtp : v.addressCurrent,
    // Kolom lama diberi nilai fallback agar admin & laporan tidak pecah.
    address: v.addressCurrent ?? v.addressKtp,
  }));

export type ParticipantInput = z.input<typeof participantSchema>;
export type ParticipantData = z.output<typeof participantSchema>;

/**
 * Body POST /api/participants, participantSchema + pilihan wilayah (kode Kemendagri) + sandi anggota.
 * Form kirim ini di luar resolver RHF (yang masih pakai participantSchema), jadi skema ini
 * dipakai khusus di route server sebagai validasi boundary.
 */
export const registerSchema = participantSchema.and(
  z.object({
    provinceCode: z
      .string({ error: "Provinsi wajib dipilih" })
      .regex(/^\d{2}$/, "Kode provinsi tidak valid"),
    regencyCode: z
      .string({ error: "Kabupaten/Kota wajib dipilih" })
      .regex(/^\d{2}$/, "Kode kabupaten/kota tidak valid"),
    password: z
      .string({ error: "Sandi wajib diisi" })
      .min(8, "Sandi minimal 8 karakter")
      .max(200, "Sandi maksimal 200 karakter"),
  }),
);
export type RegisterData = z.output<typeof registerSchema>;

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Username wajib diisi").max(100),
  password: z.string().min(1, "Password wajib diisi").max(200),
});

/**
 * Pelengkapan profil untuk peserta hasil impor (`needsProfileCompletion`).
 * Field yang wajib di sini sengaja hanya yang tidak ada di sumber impor:
 * tempat lahir, alamat, pekerjaan. Wilayah dan tanggal lahir sudah terisi.
 */
export const profileCompletionSchema = z.object({
  birthPlace: requiredText("Tempat lahir", 120),
  addressKtp: requiredText("Alamat sesuai KTP", 5000),
  addressCurrent: optionalText(5000, "Alamat tinggal saat ini"),
  addressSameAsKtp: z.preprocess((v) => (typeof v === "boolean" ? v : false), z.boolean()),
  occupation: requiredText("Pekerjaan", 150),
  /** Sandi baru; wajib karena sandi impor bersifat sementara. */
  password: z
    .string({ error: "Sandi baru wajib diisi" })
    .min(8, "Sandi baru minimal 8 karakter")
    .max(200, "Sandi baru maksimal 200 karakter"),
}).superRefine((v, ctx) => {
  if (!v.addressSameAsKtp && !v.addressCurrent) {
    ctx.addIssue({
      code: "custom",
      path: ["addressCurrent"],
      message: "Alamat tinggal wajib diisi jika berbeda dengan alamat KTP",
    });
  }
}).transform((v) => ({
  ...v,
  addressCurrent: v.addressSameAsKtp ? v.addressKtp : v.addressCurrent,
  // Kolom lama ikut diisi seperti alur pendaftaran.
  address: v.addressSameAsKtp ? v.addressKtp : (v.addressCurrent ?? v.addressKtp),
}));

export type ProfileCompletionData = z.output<typeof profileCompletionSchema>;

/**
 * Body POST /api/anggota/sandi. Sandi lama wajib dibuktikan supaya sesi yang
 * tertinggal di perangkat bersama tidak bisa dipakai mengganti sandi.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ error: "Sandi saat ini wajib diisi" })
      .min(1, "Sandi saat ini wajib diisi")
      .max(200, "Sandi maksimal 200 karakter"),
    password: z
      .string({ error: "Sandi baru wajib diisi" })
      .min(8, "Sandi baru minimal 8 karakter")
      .max(200, "Sandi baru maksimal 200 karakter"),
  })
  .superRefine((v, ctx) => {
    if (v.password === v.currentPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["password"],
        message: "Sandi baru harus berbeda dari sandi saat ini",
      });
    }
  });

export type ChangePasswordData = z.output<typeof changePasswordSchema>;

/**
 * Body PATCH /api/admin/participants/:id/profile — suntingan admin atas data
 * pribadi peserta. Semua field opsional: hanya yang dikirim yang diubah.
 *
 * NIK dan wilayah sengaja TIDAK ada di sini: NIK adalah identitas unik yang
 * dipakai login, dan wilayah punya alur sendiri (membership) yang sudah
 * mencatat riwayat. Mengubahnya lewat jalur ini akan melewati aturan itu.
 */
export const adminProfileSchema = z.object({
  fullName: requiredText("Nama lengkap", 200),
  whatsapp: whatsappSchema,
  birthPlace: requiredText("Tempat lahir", 120),
  birthDate: birthDateSchema,
  gender: z.enum(["LAKI_LAKI", "PEREMPUAN"], { error: "Jenis kelamin wajib dipilih" }),
  maritalStatus: z
    .enum(["BELUM_MENIKAH", "SUDAH_MENIKAH", "CERAI_HIDUP", "CERAI_MATI"])
    .nullable()
    .optional(),
  bloodType: z.enum(["A", "B", "AB", "O", "TIDAK_TAHU"]).nullable().optional(),
  addressKtp: requiredText("Alamat sesuai KTP", 5000),
  addressCurrent: optionalText(5000, "Alamat tinggal saat ini"),
  addressSameAsKtp: z.preprocess((v) => (typeof v === "boolean" ? v : false), z.boolean()),
  occupation: requiredText("Pekerjaan", 150),
  lastEducation: optionalText(100, "Pendidikan terakhir"),
  studyField: optionalText(150, "Bidang studi"),
  expertise: optionalText(5000, "Bidang keahlian"),
}).transform((v) => ({
  ...v,
  // Kolom `address` lama tetap dicerminkan supaya laporan dan admin lain konsisten.
  addressCurrent: v.addressSameAsKtp ? v.addressKtp : (v.addressCurrent ?? v.addressKtp),
  address: v.addressSameAsKtp ? v.addressKtp : (v.addressCurrent ?? v.addressKtp),
}));

export type AdminProfileData = z.output<typeof adminProfileSchema>;
