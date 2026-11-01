/** Shapes returned by the admin API routes. Shared with the frontend. */
export type OriginTypeValue = "PW" | "PD";
export type GenderValue = "LAKI_LAKI" | "PEREMPUAN";
export type SermonValue = "SERING" | "KADANG_KADANG" | "BELUM_PERNAH" | "LAINNYA";
export type QuranValue = "TAJWID_BAIK" | "BIASA" | "TIDAK_LANCAR";
export type MaritalValue = "BELUM_MENIKAH" | "SUDAH_MENIKAH" | "CERAI_HIDUP" | "CERAI_MATI";
export type BloodValue = "A" | "B" | "AB" | "O" | "TIDAK_TAHU";

export type ParticipantListItem = {
  id: string;
  createdAt: string;
  fullName: string;
  nikMasked: string;
  originType: OriginTypeValue;
  originName: string;
  whatsappMasked: string;
  lastEducation: string | null;
};

export type ParticipantListResponse = {
  ok: true;
  data: ParticipantListItem[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};

export type ParticipantDetail = ParticipantListItem & {
  nik: string;
  whatsapp: string;
  birthPlace: string;
  birthDate: string;
  gender: GenderValue;
  maritalStatus: MaritalValue | null;
  bloodType: BloodValue | null;
  photoPath: string | null;
  ktpPath: string | null;
  address: string;
  addressKtp: string | null;
  addressCurrent: string | null;
  addressSameAsKtp: boolean;
  province: string | null;
  city: string | null;
  occupation: string;
  expertise: string | null;
  studyField: string | null;
  sermonExperience: SermonValue;
  sermonExperienceOther: string | null;
  organizationExperience: string | null;
  quranReading: QuranValue;
  trainingReason: string;
  trainingExpectation: string;
  updatedAt: string;
};

export type StatsResponse = { ok: true; total: number; pw: number; pd: number; today: number };

export type ApiError = {
  ok: false;
  code:
    | "UNAUTHORIZED"
    | "VALIDATION"
    | "NIK_DUPLICATE"
    | "RATE_LIMIT"
    | "NOT_FOUND"
    | "SERVER_ERROR"
    | "BAD_REQUEST"
    | "OCR_UNAVAILABLE";
  message: string;
  errors?: Record<string, string>;
};
