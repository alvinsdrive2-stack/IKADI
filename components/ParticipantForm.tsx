"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { participantSchema, PHOTO_MAX_BYTES, KTP_MAX_BYTES, type ParticipantInput } from "@/lib/schema";
import { Alert } from "@/components/Alert";
import { Button } from "@/components/Button";
import { Checkbox, Field, Input, RadioGroup, Select, Textarea, controlClass, controlState } from "@/components/Field";
import { EDUCATION_OPTIONS, MARITAL_OPTIONS, BLOOD_OPTIONS } from "@/components/constants";

const ORIGIN_OPTIONS = [
  { value: "PW", label: "PW (Provinsi)" },
  { value: "PD", label: "PD (Kabupaten/Kota)" },
];

const GENDER_OPTIONS = [
  { value: "LAKI_LAKI", label: "Laki-laki" },
  { value: "PEREMPUAN", label: "Perempuan" },
];

const SERMON_OPTIONS = [
  { value: "SERING", label: "Sering" },
  { value: "KADANG_KADANG", label: "Kadang-Kadang" },
  { value: "BELUM_PERNAH", label: "Belum Pernah" },
  { value: "LAINNYA", label: "Lainnya" },
];

const QURAN_OPTIONS = [
  { value: "TAJWID_BAIK", label: "Baik Sesuai Hukum Tajwid" },
  { value: "BIASA", label: "Biasa Saja" },
  { value: "TIDAK_LANCAR", label: "Tidak Lancar" },
];

const EMPTY = {
  originType: "",
  originName: "",
  fullName: "",
  nik: "",
  birthPlace: "",
  birthDate: "",
  gender: "",
  maritalStatus: "",
  bloodType: "",
  photo: "",
  ktp: "",
  addressKtp: "",
  addressCurrent: "",
  addressSameAsKtp: true,
  province: "",
  city: "",
  address: "",
  whatsapp: "",
  lastEducation: "",
  studyField: "",
  occupation: "",
  expertise: "",
  sermonExperience: "",
  sermonExperienceOther: "",
  organizationExperience: "",
  quranReading: "",
  trainingReason: "",
  trainingExpectation: "",
  consent: false,
} as unknown as ParticipantInput;

const NETWORK =
  "Koneksi bermasalah. Data belum terkirim — periksa internet lalu coba lagi.";

/** Draf disimpan tanpa gambar: base64 KTP bisa 10 MB, jauh di atas kuota localStorage. */
const DRAFT_KEY = "ikadi:draft:v1";

type FieldKey = keyof ParticipantInput;

/** Urutan DOM = urutan visual (dipakai ErrorSummary). */
const FIELD_LABELS: Record<FieldKey, string> = {
  originType: "Asal IKADI",
  originName: "Nama PW/PD IKADI",
  fullName: "Nama Lengkap & Gelar",
  nik: "Nomor NIK KTP",
  gender: "Jenis Kelamin",
  maritalStatus: "Status Pernikahan",
  bloodType: "Golongan Darah",
  birthPlace: "Tempat Lahir",
  birthDate: "Tanggal Lahir",
  photo: "Pas Foto",
  ktp: "Foto KTP",
  addressKtp: "Alamat sesuai KTP",
  addressCurrent: "Alamat Tinggal Saat Ini",
  addressSameAsKtp: "Alamat Tinggal Sama dengan KTP",
  province: "Provinsi",
  city: "Kabupaten/Kota",
  address: "Alamat",
  whatsapp: "No. WhatsApp",
  lastEducation: "Pendidikan Terakhir",
  studyField: "Bidang Studi",
  occupation: "Pekerjaan",
  expertise: "Bidang Keahlian",
  sermonExperience: "Pengalaman Khutbah",
  sermonExperienceOther: "Keterangan Pengalaman Khutbah",
  organizationExperience: "Pengalaman Organisasi - Jabatan",
  quranReading: "Kemampuan Membaca Al-Qur'an",
  trainingReason: "Alasan Mengikuti Pelatihan",
  trainingExpectation: "Harapan Setelah Pelatihan",
  consent: "Persetujuan",
};

const DRAFT_FIELDS = (Object.keys(FIELD_LABELS) as FieldKey[]).filter(
  (k) => k !== "ktp" && k !== "photo",
);

/** Field OCR -> field form. religion diabaikan (tidak ada kolomnya di DB). */
const OCR_TO_FORM: Partial<Record<string, FieldKey>> = {
  nik: "nik",
  fullName: "fullName",
  birthPlace: "birthPlace",
  birthDate: "birthDate",
  gender: "gender",
  bloodType: "bloodType",
  addressKtp: "addressKtp",
  province: "province",
  city: "city",
  maritalStatus: "maritalStatus",
  occupation: "occupation",
};

/** Urutan id DOM untuk scroll ke field low-confidence pertama. */
const OCR_FIELD_ORDER: FieldKey[] = [
  "nik",
  "fullName",
  "birthPlace",
  "birthDate",
  "gender",
  "bloodType",
  "maritalStatus",
  "addressKtp",
  "province",
  "city",
  "occupation",
];

type OcrFields = Record<string, { value: string | null; confidence: number }>;

/** Cara mengisi. KTP wajib di ketiganya — bedanya hanya apakah data terisi otomatis. */
type Mode = "foto" | "galeri" | "manual";
type View = "choice" | "review" | "form";

type Step = {
  key: string;
  title: string;
  fields: readonly FieldKey[];
};

/** Empat langkah; urutan field di sini juga urutan validasi per langkah. */
const STEPS: readonly Step[] = [
  {
    key: "dokumen",
    title: "Dokumen & kontak",
    fields: ["ktp", "addressKtp", "addressSameAsKtp", "addressCurrent", "province", "city", "whatsapp"],
  },
  {
    key: "identitas",
    title: "Identitas",
    fields: ["originType", "originName", "fullName", "nik", "gender", "maritalStatus", "bloodType", "birthPlace", "birthDate", "photo"],
  },
  {
    key: "latar",
    title: "Latar belakang",
    fields: ["occupation", "lastEducation", "studyField", "expertise", "sermonExperience", "sermonExperienceOther", "organizationExperience", "quranReading"],
  },
  {
    key: "kirim",
    title: "Motivasi & persetujuan",
    fields: ["trainingReason", "trainingExpectation", "consent"],
  },
];

export function ParticipantForm() {
  const router = useRouter();
  // ref callback -> fokus tanpa akses ref di render (aturan react-hooks/refs)
  const focusOnMount = useCallback(
    (el: HTMLDivElement | null) => el?.focus(),
    [],
  );
  const [view, setView] = useState<View>("choice");
  const [mode, setMode] = useState<Mode>("foto");
  const [step, setStep] = useState(0);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ field: FieldKey; message: string }[]>([]);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrConfidence, setOcrConfidence] = useState<Partial<Record<FieldKey, number>>>({});
  const [ocrThreshold, setOcrThreshold] = useState<number | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    reset,
    getValues,
    getFieldState,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<ParticipantInput>({
    resolver: zodResolver(participantSchema),
    defaultValues: EMPTY,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const originType = useWatch({ control, name: "originType" });
  const sermon = useWatch({ control, name: "sermonExperience" });
  const quran = useWatch({ control, name: "quranReading" });
  const consent = useWatch({ control, name: "consent" });
  const gender = useWatch({ control, name: "gender" });
  const maritalStatus = useWatch({ control, name: "maritalStatus" });
  const sameAsKtp = useWatch({ control, name: "addressSameAsKtp" }) ?? true;
  const addressKtp = useWatch({ control, name: "addressKtp" });
  const ktpValue = useWatch({ control, name: "ktp" });
  const photoValue = useWatch({ control, name: "photo" });

  /** Confidence hanya ditandai bila di bawah threshold dari service. */
  const low = (k: FieldKey) => {
    const c = ocrConfidence[k];
    return c !== undefined && ocrThreshold !== null && c < ocrThreshold ? c : undefined;
  };

  /** Edit manual -> penanda OCR low-confidence field itu dihapus. */
  const clearOcr = useCallback((k: FieldKey) => {
    setOcrConfidence((prev) => {
      if (!(k in prev)) return prev;
      const next = { ...prev };
      delete next[k];
      return next;
    });
  }, []);

  /** register + auto-hapus penanda OCR saat field diedit. */
  const reg = useCallback(
    (k: FieldKey) => {
      const props = register(k);
      return {
        ...props,
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
          props.onChange(e);
          clearOcr(k);
        },
      };
    },
    // register stabil di RHF; clearOcr stabil via useCallback.
    [register, clearOcr],
  );

  const applyOcr = useCallback(
    (fields: OcrFields, threshold: number) => {
      const conf: Partial<Record<FieldKey, number>> = {};
      for (const [ocrKey, fieldKey] of Object.entries(OCR_TO_FORM)) {
        const f = fields[ocrKey];
        if (!fieldKey || !f) continue;
        conf[fieldKey] = f.confidence;
        if (f.value !== null) {
          setValue(fieldKey, f.value as never, { shouldValidate: true });
        }
      }
      setOcrConfidence(conf);
      setOcrThreshold(threshold);
    },
    [setValue],
  );

  // ponytail: baca file via FileReader (base64) — form sudah JSON; upgrade ke FormData + route terpisah kalau butuh >1 MB.
  const onPhotoChange = useCallback(
    (file: File | undefined) => {
      if (!file) {
        setValue("photo", "", { shouldValidate: true });
        return;
      }
      if (file.size > PHOTO_MAX_BYTES) {
        setError("photo", { type: "manual", message: "Ukuran pas foto maksimal 1 MB" });
        setValue("photo", "", { shouldValidate: false });
        return;
      }
      const reader = new FileReader();
      reader.onload = () =>
        setValue("photo", String(reader.result), { shouldValidate: true });
      reader.onerror = () =>
        setError("photo", { type: "manual", message: "Pas foto gagal dibaca. Coba pilih file lain." });
      reader.readAsDataURL(file);
    },
    [setError, setValue],
  );

  /**
   * Turunkan resolusi foto untuk OCR: inference CPU jauh lebih cepat
   * (target < 5 detik) dan bacaan teks tetap akurat. Kalau browser gak
   * support createImageBitmap atau hasilnya malah lebih besar, pakai file asli.
   */
  const downscaleForOcr = useCallback(async (file: File, maxSide = 1500): Promise<Blob> => {
    try {
      if (typeof createImageBitmap !== "function") return file;
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        bitmap.close();
        return file;
      }
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85),
      );
      return blob && blob.size < file.size ? blob : file;
    } catch {
      return file;
    }
  }, []);

  /** Upload KTP: base64 disimpan ke form dulu (submit tetap jalan tanpa OCR), lalu OCR autofill. */
  const onKtpChange = useCallback(
    (file: File | undefined) => {
      if (!file) {
        setValue("ktp", "", { shouldValidate: true });
        setOcrError(null);
        setOcrConfidence({});
        return;
      }
      if (file.size > KTP_MAX_BYTES) {
        setError("ktp", { type: "manual", message: "Ukuran foto KTP maksimal 10 MB" });
        setValue("ktp", "", { shouldValidate: false });
        return;
      }

      const reader = new FileReader();
      reader.onload = () =>
        setValue("ktp", String(reader.result), { shouldValidate: true });
      reader.onerror = () =>
        setError("ktp", { type: "manual", message: "Foto KTP gagal dibaca. Coba pilih file lain." });
      reader.readAsDataURL(file);

      // Jalur manual: foto tetap wajib, tapi tidak ada pembacaan otomatis.
      if (mode === "manual") return;

      // OCR terpisah dari pembacaan base64 — kegagalan OCR tidak membatalkan isi form.
      setOcrLoading(true);
      setOcrError(null);
      setOcrConfidence({});
      setView("review");
      (async () => {
        try {
          const ocrBlob = await downscaleForOcr(file);
          const form = new FormData();
          form.append("file", ocrBlob, file.name || "ktp.jpg");
          const res = await fetch("/api/participants/ocr", { method: "POST", body: form });
          const body = await res.json().catch(() => null);
          if (res.ok && body?.ok) {
            applyOcr(body.fields as OcrFields, Number(body.threshold));
          } else if (res.status === 503 || body?.code === "OCR_UNAVAILABLE") {
            setOcrError("Layanan OCR sedang tidak tersedia. Silakan isi data secara manual.");
          } else if (res.status === 429) {
            setOcrError("Terlalu banyak percobaan OCR. Tunggu beberapa menit lalu coba lagi.");
          } else {
            setOcrError(String(body?.message ?? "OCR gagal. Silakan isi data secara manual."));
          }
        } catch {
          setOcrError("Koneksi bermasalah. Data KTP tersimpan, tapi OCR tidak jalan — isi manual.");
        } finally {
          setOcrLoading(false);
        }
      })();
    },
    [applyOcr, downscaleForOcr, mode, setError, setValue],
  );

  useEffect(() => {
    if (sermon && sermon !== "LAINNYA") setValue("sermonExperienceOther", "");
  }, [sermon, setValue]);

  // Dicentang "sesuai KTP" -> alamat tinggal selalu ikut alamat KTP (disabled).
  useEffect(() => {
    if (sameAsKtp) setValue("addressCurrent", addressKtp ?? "");
  }, [sameAsKtp, addressKtp, setValue]);

  // Draf: pulihkan sekali saat mount. Gambar tidak ikut disimpan.
  const draftLoaded = useRef(false);
  useEffect(() => {
    if (draftLoaded.current) return;
    draftLoaded.current = true;
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<ParticipantInput>;
      reset({ ...EMPTY, ...saved } as ParticipantInput);
    } catch {
      // localStorage diblokir/penuh — formulir tetap jalan tanpa draf.
    }
  }, [reset]);

  const persistDraft = useCallback(() => {
    try {
      const values = getValues() as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const k of DRAFT_FIELDS) out[k] = values[k];
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(out));
    } catch {
      // Kuota penuh / mode privat — abaikan, draf cuma kenyamanan.
    }
  }, [getValues]);

  const isOther = sermon === "LAINNYA";
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const goStep = useCallback((next: number) => {
    setStep(Math.max(0, Math.min(STEPS.length - 1, next)));
    if (typeof document !== "undefined") {
      requestAnimationFrame(() =>
        document.getElementById("form-langkah")?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  }, []);

  const nextStep = useCallback(async () => {
    persistDraft();
    const ok = await trigger([...current.fields]);
    if (!ok) {
      // getFieldState membaca state terbaru setelah trigger; `errors` dari closure masih lama.
      const firstBad = current.fields.find((k) => getFieldState(k).invalid);
      if (firstBad) requestAnimationFrame(() => document.getElementById(firstBad)?.focus());
      return;
    }
    goStep(step + 1);
  }, [current.fields, getFieldState, goStep, persistDraft, step, trigger]);

  const prevStep = useCallback(() => {
    persistDraft();
    goStep(step - 1);
  }, [goStep, persistDraft, step]);

  const onInvalid = () => {
    const items = (Object.keys(FIELD_LABELS) as FieldKey[])
      .filter((k) => errors[k] && (k !== "sermonExperienceOther" || isOther))
      .map((k) => ({ field: k, message: String(errors[k]?.message ?? "") }));
    setSummary(items);
    setGlobalError(null);
    // Lompat ke langkah yang memuat error pertama — kalau tidak, ringkasan menunjuk field di layar lain.
    const first = items[0]?.field;
    if (first) {
      const idx = STEPS.findIndex((s) => s.fields.includes(first));
      if (idx >= 0) goStep(idx);
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    setSummary([]);
    setGlobalError(null);
    try {
      const res = await fetch("/api/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (res.status === 201) {
        try {
          window.localStorage.removeItem(DRAFT_KEY);
        } catch {
          // abaikan
        }
        router.push("/daftar/sukses");
        return;
      }

      const body = await res.json().catch(() => null);

      if (res.status === 400 && body?.errors) {
        for (const [field, msg] of Object.entries(body.errors)) {
          setError(field as FieldKey, { type: "server", message: String(msg) });
        }
        setGlobalError("Periksa kembali isian yang ditandai merah.");
      } else if (res.status === 409 || body?.code === "NIK_DUPLICATE") {
        setError("nik", {
          type: "server",
          message:
            "NIK ini sudah terdaftar. Silakan hubungi admin jika membutuhkan bantuan.",
        });
        setGlobalError(
          "NIK ini sudah terdaftar. Silakan hubungi admin jika membutuhkan bantuan.",
        );
      } else if (res.status === 429) {
        setGlobalError("Terlalu banyak percobaan. Tunggu satu menit lalu coba lagi.");
      } else if (res.status >= 500) {
        setGlobalError("Maaf, terjadi kendala di server. Coba lagi beberapa saat.");
      } else {
        setGlobalError(NETWORK);
      }
    } catch {
      setGlobalError(NETWORK);
    }
  }, onInvalid);

  const opt = (k: FieldKey) => (errors[k]?.message ? String(errors[k]?.message) : undefined);

  const chooseMode = (m: Mode) => {
    setMode(m);
    setView("form");
    setStep(0);
  };

  if (view === "choice") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-ink">Mau diisi bagaimana?</h2>
          <p className="mt-1 text-base text-ink-muted">
            Pilih yang paling gampang buat Anda.
          </p>
        </div>

        <div className="space-y-3">
          <ModeOption
            onSelect={() => chooseMode("foto")}
            title="Foto KTP sekarang"
            body="Kamera terbuka, data terisi otomatis. Paling cepat."
            badge="Tercepat"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5" aria-hidden>
                <path d="M4 8h3l1.5-2h7L17 8h3v10H4z" />
                <circle cx="12" cy="12.5" r="3" />
              </svg>
            }
          />
          <ModeOption
            onSelect={() => chooseMode("galeri")}
            title="Pilih foto KTP dari galeri"
            body="Kalau fotonya sudah ada di ponsel."
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5" aria-hidden>
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <circle cx="9" cy="10" r="1.6" />
                <path d="m4 18 5-5 3 3 3-3 4 4" />
              </svg>
            }
          />
          <ModeOption
            onSelect={() => chooseMode("manual")}
            title="Isi sendiri dulu"
            body="Ketik manual, data tidak terisi otomatis. Foto KTP tetap diminta di langkah pertama."
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5" aria-hidden>
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <path d="M8 14h8M6 10h.01M10 10h.01" strokeLinecap="round" />
              </svg>
            }
          />
        </div>

        <p className="rounded-md bg-bg p-3 text-sm text-ink-muted">
          Ketiga cara tetap wajib melampirkan foto KTP. Bedanya hanya di apakah data terisi otomatis.
        </p>
      </div>
    );
  }

  if (view === "review") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-ink">Cek hasil baca KTP</h2>
          <p className="mt-1 text-base text-ink-muted">
            Cocokkan dengan KTP. Yang ditandai kuning perlu Anda periksa.
          </p>
        </div>

        {ocrLoading && (
          <p role="status" className="rounded-md border border-border bg-surface p-4 text-sm text-ink-muted">
            Sedang membaca KTP...
          </p>
        )}

        {ocrError && <Alert tone="error">{ocrError}</Alert>}

        {!ocrLoading && (
          <ul className="divide-y divide-border rounded-md border border-border bg-surface">
            {OCR_FIELD_ORDER.map((k) => {
              const c = ocrConfidence[k];
              const value = String(getValues(k as never) ?? "").trim();
              if (c === undefined && !value) return null;
              const sus = low(k);
              return (
                <li key={k} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-ink-muted">{FIELD_LABELS[k]}</span>
                    <span className="block break-words text-base font-semibold text-ink">
                      {value || "—"}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      sus !== undefined
                        ? "bg-accent-soft text-accent-ink"
                        : "bg-primary-soft text-primary-ink"
                    }`}
                  >
                    {sus !== undefined ? "cek" : "terbaca"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <div className="sticky bottom-0 -mx-1 flex gap-3 rounded-t-xl border-t border-border bg-surface p-3">
          <Button
            variant="secondary"
            className="flex-none"
            onClick={() => {
              setView("choice");
              setOcrError(null);
            }}
          >
            Ulangi
          </Button>
          <Button className="flex-1" onClick={() => setView("form")}>
            {ocrError ? "Lanjut isi manual" : "Benar, lanjut"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-6" aria-busy={isSubmitting}>
      {summary.length > 0 && (
        <div
          ref={focusOnMount}
          role="alert"
          tabIndex={-1}
          className="rounded-md border-2 border-danger bg-danger-soft p-4"
        >
          <h2 className="text-base font-semibold text-danger">
            Ada {summary.length} isian yang perlu diperbaiki
          </h2>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-danger">
            {summary.map((item) => (
              <li key={item.field}>
                <a
                  href={`#${item.field}`}
                  className="underline underline-offset-2"
                >
                  {FIELD_LABELS[item.field]}: {item.message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-1.5" id="form-langkah">
        <div className="flex items-center justify-between text-sm font-semibold text-ink-muted">
          <span>
            Langkah {step + 1} dari {STEPS.length}
          </span>
          <span aria-live="polite">{current.title}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.round(((step + 1) / STEPS.length) * 100)}%` }}
          />
        </div>
      </div>

      {step === 0 && (
        <StepPanel n={1} title="Dokumen & kontak">
          <KtpField
            mode={mode}
            hasKtp={Boolean(ktpValue)}
            error={opt("ktp")}
            onChange={onKtpChange}
          />
          <Textarea
            id="addressKtp"
            label="Alamat sesuai KTP"
            required
            rows={3}
            hint="Salin persis dari KTP: jalan, RT/RW, kelurahan/desa, kecamatan."
            error={opt("addressKtp")}
            ocrLow={low("addressKtp")}
            {...reg("addressKtp")}
          />
          <Checkbox
            id="addressSameAsKtp"
            checked={sameAsKtp === true}
            onChange={(v) =>
              setValue("addressSameAsKtp", v as unknown as ParticipantInput["addressSameAsKtp"], {
                shouldValidate: true,
              })
            }
            label="Alamat tinggal saya saat ini sama dengan alamat KTP"
          />
          <Textarea
            id="addressCurrent"
            label="Alamat Tinggal Saat Ini"
            rows={3}
            hint={sameAsKtp ? "Terisi otomatis dari alamat KTP." : "Wajib diisi jika berbeda dengan alamat KTP."}
            disabled={sameAsKtp === true}
            error={opt("addressCurrent")}
            {...reg("addressCurrent")}
          />
          <div className="grid gap-6 md:grid-cols-2">
            <Input
              id="province"
              label="Provinsi"
              required
              error={opt("province")}
              ocrLow={low("province")}
              {...reg("province")}
            />
            <Input
              id="city"
              label="Kabupaten/Kota"
              required
              error={opt("city")}
              ocrLow={low("city")}
              {...reg("city")}
            />
          </div>
          <Input
            id="whatsapp"
            label="No. WhatsApp"
            required
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            hint="Contoh: 085987654321 atau +6285987654321."
            error={opt("whatsapp")}
            {...register("whatsapp")}
          />
        </StepPanel>
      )}

      {step === 1 && (
        <StepPanel n={2} title="Identitas">
          <div id="originType">
            <RadioGroup
              label="Asal IKADI"
              required
              name="originType"
              columns={2}
              options={ORIGIN_OPTIONS}
              value={originType ?? ""}
              onChange={(v) => setValue("originType", v as ParticipantInput["originType"], { shouldValidate: true })}
              error={opt("originType")}
            />
          </div>
          <Input
            id="originName"
            label="Nama PW/PD IKADI"
            required
            placeholder={originType === "PD" ? "Contoh: PD IKADI Kab. Sleman" : "Contoh: PW IKADI DIY"}
            error={opt("originName")}
            {...register("originName")}
          />
          <Input
            id="fullName"
            label="Nama Lengkap & Gelar"
            required
            autoComplete="name"
            error={opt("fullName")}
            ocrLow={low("fullName")}
            {...reg("fullName")}
          />
          <Input
            id="nik"
            label="Nomor NIK KTP"
            required
            inputMode="numeric"
            autoComplete="off"
            maxLength={17}
            hint="16 digit angka sesuai KTP, tanpa spasi."
            error={opt("nik")}
            ocrLow={low("nik")}
            {...reg("nik")}
          />
          <div id="gender">
            <RadioGroup
              label="Jenis Kelamin"
              required
              name="gender"
              columns={2}
              options={GENDER_OPTIONS}
              value={gender ?? ""}
              onChange={(v) => {
                setValue("gender", v as ParticipantInput["gender"], { shouldValidate: true });
                clearOcr("gender");
              }}
              error={opt("gender")}
              ocrLow={low("gender")}
            />
          </div>
          <div id="maritalStatus">
            <RadioGroup
              label="Status Pernikahan"
              required
              name="maritalStatus"
              columns={2}
              options={MARITAL_OPTIONS}
              value={maritalStatus ?? ""}
              onChange={(v) => {
                setValue("maritalStatus", v as ParticipantInput["maritalStatus"], { shouldValidate: true });
                clearOcr("maritalStatus");
              }}
              error={opt("maritalStatus")}
              ocrLow={low("maritalStatus")}
            />
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <Select
              id="bloodType"
              label="Golongan Darah"
              required
              options={[
                { value: "", label: "Pilih golongan darah", disabled: true },
                ...BLOOD_OPTIONS,
              ]}
              error={opt("bloodType")}
              {...reg("bloodType")}
            />
            <Input
              id="birthPlace"
              label="Tempat Lahir"
              required
              error={opt("birthPlace")}
              ocrLow={low("birthPlace")}
              {...reg("birthPlace")}
            />
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <Input
              id="birthDate"
              label="Tanggal Lahir"
              required
              type="date"
              error={opt("birthDate")}
              ocrLow={low("birthDate")}
              {...reg("birthDate")}
            />
            <Field id="photo" label="Pas Foto" hint="Opsional. Format JPEG, PNG, atau WebP. Maksimal 1 MB." error={opt("photo")}>
              <input
                id="photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                aria-invalid={errors.photo ? true : undefined}
                aria-describedby="photo-hint photo-error"
                onChange={(e) => onPhotoChange(e.target.files?.[0])}
                className={`h-11 ${controlClass} file:mr-3 file:h-full file:border-0 file:bg-surface file:px-3 file:text-base file:text-ink ${controlState(opt("photo"))}`}
              />
              {Boolean(photoValue) && (
                <p className="text-sm font-medium text-primary">Pas foto sudah dipilih.</p>
              )}
            </Field>
          </div>
        </StepPanel>
      )}

      {step === 2 && (
        <StepPanel n={3} title="Latar belakang">
          <div className="grid gap-6 md:grid-cols-2">
            <Input
              id="occupation"
              label="Pekerjaan"
              required
              error={opt("occupation")}
              ocrLow={low("occupation")}
              {...reg("occupation")}
            />
            <Select
              id="lastEducation"
              label="Pendidikan Terakhir"
              options={[
                { value: "", label: "Pilih pendidikan", disabled: true },
                ...EDUCATION_OPTIONS.map((o) => ({ value: o, label: o })),
              ]}
              error={opt("lastEducation")}
              {...register("lastEducation")}
            />
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <Input
              id="studyField"
              label="Bidang Studi"
              hint="Opsional — bidang studi akademis terakhir."
              error={opt("studyField")}
              {...register("studyField")}
            />
            <Input
              id="expertise"
              label="Bidang Keahlian"
              hint="Opsional."
              error={opt("expertise")}
              {...register("expertise")}
            />
          </div>
          <div id="sermonExperience">
            <RadioGroup
              label="Pengalaman Khutbah"
              required
              name="sermonExperience"
              columns={1}
              options={SERMON_OPTIONS}
              value={sermon ?? ""}
              onChange={(v) => {
                setValue(
                  "sermonExperience",
                  v as ParticipantInput["sermonExperience"],
                  { shouldValidate: true },
                );
                if (v === "LAINNYA") {
                  requestAnimationFrame(() =>
                    document.getElementById("sermonExperienceOther")?.focus(),
                  );
                }
              }}
              error={opt("sermonExperience")}
              controlsId={isOther ? "sermonExperienceOther" : undefined}
            />
          </div>
          {isOther && (
            <Textarea
              id="sermonExperienceOther"
              label="Keterangan Pengalaman Khutbah"
              rows={2}
              error={opt("sermonExperienceOther")}
              {...register("sermonExperienceOther")}
            />
          )}
          <Textarea
            id="organizationExperience"
            label="Pengalaman Organisasi - Jabatan"
            rows={2}
            hint="Opsional."
            error={opt("organizationExperience")}
            {...register("organizationExperience")}
          />
          <div id="quranReading">
            <RadioGroup
              label="Kemampuan Membaca Al-Qur'an"
              required
              name="quranReading"
              columns={1}
              options={QURAN_OPTIONS}
              value={quran ?? ""}
              onChange={(v) =>
                setValue("quranReading", v as ParticipantInput["quranReading"], {
                  shouldValidate: true,
                })
              }
              error={opt("quranReading")}
            />
          </div>
        </StepPanel>
      )}

      {step === 3 && (
        <StepPanel n={4} title="Motivasi & persetujuan">
          <Textarea
            id="trainingReason"
            label="Alasan Mengikuti Pelatihan"
            required
            rows={3}
            error={opt("trainingReason")}
            {...register("trainingReason")}
          />
          <Textarea
            id="trainingExpectation"
            label="Harapan Setelah Pelatihan"
            required
            rows={3}
            error={opt("trainingExpectation")}
            {...register("trainingExpectation")}
          />
          <div id="consent">
            <Checkbox
              id="consent"
              checked={consent === true}
              onChange={(v) =>
                setValue("consent", v as unknown as ParticipantInput["consent"], {
                  shouldValidate: true,
                })
              }
              error={opt("consent")}
              label={
                <>
                  Saya memahami data yang saya isi digunakan untuk pendataan KTA IKADI
                  dan saya dapat dihubungi melalui nomor WhatsApp yang dicantumkan.
                </>
              }
            />
          </div>
        </StepPanel>
      )}

      {globalError && (
        <div key={globalError} ref={focusOnMount} tabIndex={-1}>
          <Alert tone="error">{globalError}</Alert>
        </div>
      )}

      <div className="sticky bottom-0 -mx-1 flex gap-3 rounded-t-xl border-t border-border bg-surface p-3 shadow-raised">
        {step > 0 && (
          <Button variant="secondary" className="flex-none" onClick={prevStep} disabled={isSubmitting}>
            Kembali
          </Button>
        )}
        {isLast ? (
          <Button type="submit" disabled={isSubmitting} loading={isSubmitting} className="flex-1">
            {isSubmitting ? "Mengirim..." : "Kirim Data"}
          </Button>
        ) : (
          <Button className="flex-1" onClick={nextStep}>
            Lanjut
          </Button>
        )}
      </div>

      <p className="text-sm text-ink-muted">
        Kolom bertanda{" "}
        <span className="text-primary" aria-hidden>
          *
        </span>{" "}
        wajib diisi.
      </p>
    </form>
  );
}

/** Kartu pilihan cara mengisi. Seluruh kartu bisa diketuk (target > 48px). */
function ModeOption({
  title,
  body,
  badge,
  icon,
  onSelect,
}: {
  title: string;
  body: string;
  badge?: string;
  icon: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-start gap-3 rounded-xl border border-control-border bg-surface p-4 text-left transition-colors hover:border-primary hover:bg-bg"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold text-ink">{title}</span>
        <span className="block text-sm text-ink-muted">{body}</span>
      </span>
      {badge && (
        <span className="shrink-0 rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary-ink">
          {badge}
        </span>
      )}
    </button>
  );
}

/**
 * Foto KTP wajib di semua jalur. Mode menentukan sumber gambar:
 * `foto` = kamera, `galeri` = pemilih file, `manual` = pemilih file tanpa OCR.
 */
function KtpField({
  mode,
  hasKtp,
  error,
  onChange,
}: {
  mode: Mode;
  hasKtp: boolean;
  error?: string;
  onChange: (file: File | undefined) => void;
}) {
  const hint =
    mode === "manual"
      ? "Wajib. Pilih foto KTP dari perangkat — data tidak akan terbaca otomatis."
      : "Wajib. Foto dari sini membuat data terisi otomatis.";

  return (
    <Field id="ktp" label="Foto KTP" required hint={hint} error={error}>
      <div className="space-y-2">
        <input
          id="ktp"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture={mode === "foto" ? "environment" : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby="ktp-hint ktp-error"
          onChange={(e) => onChange(e.target.files?.[0])}
          className={`h-11 ${controlClass} file:mr-3 file:h-full file:border-0 file:bg-surface file:px-3 file:text-base file:text-ink ${controlState(error)}`}
        />
        {hasKtp && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-4 shrink-0">
              <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Foto KTP sudah dilampirkan.
          </p>
        )}
      </div>
    </Field>
  );
}

function StepPanel({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="rounded-xl border border-border bg-surface p-5 shadow-card sm:p-6 lg:p-8">
      <legend className="px-1 text-lg font-semibold text-ink">
        <span aria-hidden="true" className="mr-2 inline-block size-2 rounded-full bg-accent align-middle" />
        {n}. {title}
      </legend>
      <div className="mt-4 space-y-6">{children}</div>
    </fieldset>
  );
}
