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
import { PROVINCE_OPTIONS, regencyOptions } from "@/components/WilayahOptions";
import { CustomCamera } from "@/components/CustomCamera";
import { SearchSelect } from "@/components/ui/search-select";
import { IdCard, Images, Camera, PencilLine, Check } from "lucide-react";

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

/** Pilihan awal: upload KTP (ada OCR) atau tidak upload (isi manual). */
type RootChoice = "upload" | "manual";
/** Sumber KTP untuk upload: kamera langsung (custom) atau galeri. */
type Mode = "foto" | "galeri";
/** `choice` = upload / tidak, `source` = kamera / galeri, `camera` = layar bidik, `review` = cek OCR, `form` = isi form. */
type View = "choice" | "source" | "camera" | "review" | "form";

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
  const [rootChoice, setRootChoice] = useState<RootChoice>("upload");
  const [mode, setMode] = useState<Mode>("foto");
  const [step, setStep] = useState(0);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ field: FieldKey; message: string }[]>([]);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrConfidence, setOcrConfidence] = useState<Partial<Record<FieldKey, number>>>({});
  const [ocrThreshold, setOcrThreshold] = useState<number | null>(null);
  // Kode wilayah dipilih dari dropdown berantai; nama tetap diturunkan ke RHF (province/city)
  // agar kompatibel dengan skema lama. Kode dikirim bersamaan supaya backend menyimpan kode.
  const [provinceCode, setProvinceCode] = useState("");
  const [regencyCode, setRegencyCode] = useState("");
  const [regionError, setRegionError] = useState<{ province?: string; city?: string }>({});
  // Sandi keanggotaan: tidak lewat RHF supaya tidak ikut tervalidasi Zod lama.
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string>();

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

      // Jalur tidak-upload: tidak ada OCR, foto opsional di langkah pertama.
      if (rootChoice === "manual") return;

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
    [applyOcr, downscaleForOcr, rootChoice, setError, setValue],
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
    // Wilayah: dropdown berantai divalidasi manual (tidak lewat skema Zod lama).
    if (step === 0) {
      const prov = !!provinceCode;
      const city = !!regencyCode;
      setRegionError({
        province: prov ? undefined : "Provinsi wajib dipilih",
        city: city ? undefined : "Kabupaten/Kota wajib dipilih",
      });
      if (!prov || !city) {
        requestAnimationFrame(() =>
          document.getElementById(prov ? "city" : "province")?.focus(),
        );
        return;
      }
      // Jalur upload: KTP wajib — schema sekarang opsional, cek manual di sini.
      if (rootChoice === "upload" && !getValues("ktp")) {
        setError("ktp", { type: "manual", message: "Foto KTP wajib diisi untuk jalur upload" });
        requestAnimationFrame(() => document.getElementById("ktp")?.focus());
        return;
      }
    }
    const ok = await trigger([...current.fields]);
    if (!ok) {
      // getFieldState membaca state terbaru setelah trigger; `errors` dari closure masih lama.
      const firstBad = current.fields.find((k) => getFieldState(k).invalid);
      if (firstBad) requestAnimationFrame(() => document.getElementById(firstBad)?.focus());
      return;
    }
    goStep(step + 1);
  }, [current.fields, getFieldState, getValues, goStep, persistDraft, provinceCode, regencyCode, rootChoice, setError, step, trigger]);

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
    // Wilayah wajib dipilih dari dropdown berantai (bukan lewat Zod lama).
    if (!provinceCode || !regencyCode) {
      setRegionError({
        province: provinceCode ? undefined : "Provinsi wajib dipilih",
        city: regencyCode ? undefined : "Kabupaten/Kota wajib dipilih",
      });
      goStep(0);
      return;
    }
    // Jalur upload: KTP wajib (schema opsional, cek di submit juga)
    if (rootChoice === "upload" && !values.ktp) {
      setError("ktp", { type: "manual", message: "Foto KTP wajib diisi untuk jalur upload" });
      goStep(0);
      return;
    }
    // Sandi keanggotaan: wajib, min 8, dua isian sama.
    const pwErr =
      password.length < 8
        ? "Sandi minimal 8 karakter."
        : password !== confirmPassword
          ? "Konfirmasi sandi tidak sama."
          : undefined;
    setPasswordError(pwErr);
    if (pwErr) {
      requestAnimationFrame(() => document.getElementById("password")?.focus());
      return;
    }
    try {
      const res = await fetch("/api/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          provinceCode,
          regencyCode,
          password,
        }),
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
          if (field === "password") {
            setPasswordError(String(msg));
            requestAnimationFrame(() => document.getElementById("password")?.focus());
            continue;
          }
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

  /** Berapa field OCR yang benar-benar terisi — dipakai banner ringkasan di layar cek. */
  const ocrCount = OCR_FIELD_ORDER.filter(
    (k) => ocrConfidence[k] !== undefined && String(getValues(k as never) ?? "").trim() !== "",
  ).length;

  const chooseRoot = (c: RootChoice) => {
    setRootChoice(c);
    setOcrError(null);
    setOcrConfidence({});
    setStep(0);
    setView(c === "manual" ? "form" : "source");
  };

  const chooseMode = (m: Mode) => {
    setMode(m);
    setOcrError(null);
    setView("camera");
    setStep(0);
  };

  if (view === "choice") {
    return (
      <div className="flex min-h-[60dvh] flex-col gap-4 md:block md:min-h-0 md:space-y-6">

        <div className="md:block">
          <h2 className="text-lg font-semibold text-ink">Upload foto KTP?</h2>
          <p className="mt-1 text-base text-ink-muted">
            Kalau upload, data terisi otomatis dari KTP. Kalau tidak, isi manual semua.
          </p>
        </div>

        <div className="space-y-3">
          <ModeOption
            onSelect={() => chooseRoot("upload")}
            title="Upload foto KTP"
            body="Foto KTP dibaca OCR, NIK & nama terisi otomatis. Paling cepat."
            badge="Tercepat"
            icon={<IdCard aria-hidden className="size-5" strokeWidth={2} />}
          />
          <ModeOption
            onSelect={() => chooseRoot("manual")}
            title="Tidak upload KTP"
            body="Ketik manual semua data. Foto KTP tidak wajib di langkah pertama."
            icon={<PencilLine aria-hidden className="size-5" strokeWidth={2} />}
          />
        </div>

        <p className="mt-auto rounded-xl bg-primary-soft/40 p-3 text-sm text-ink-muted md:mt-6">
          Upload = OCR otomatis. Tidak upload = isi manual. Keduanya tetap membuat akun anggota pakai NIK + sandi.
        </p>
      </div>
    );
  }

  if (view === "source") {
    return (
      <div className="flex min-h-[60dvh] flex-col gap-4 md:block md:min-h-0 md:space-y-6">
        <div className="md:block">
          <button type="button" onClick={() => setView("choice")} className="mb-3 inline-flex min-h-11 items-center gap-1.5 rounded-[4px] px-2 text-sm font-medium text-primary hover:bg-surface">
            ← Kembali
          </button>
          <h2 className="text-lg font-semibold text-ink">Sumber foto KTP</h2>
          <p className="mt-1 text-base text-ink-muted">Pilih kamera langsung atau foto yang sudah ada di galeri.</p>
        </div>

        <div className="space-y-3">
          <ModeOption
            onSelect={() => chooseMode("foto")}
            title="Foto langsung dari HP"
            body="Kamera custom dengan bingkai KTP. Geser jadi pas, ketuk tombol bulat buat foto."
            badge="Tercepat"
            icon={<Camera aria-hidden className="size-5" strokeWidth={2} />}
          />
          <ModeOption
            onSelect={() => chooseMode("galeri")}
            title="Pilih dari galeri"
            body="Kalau foto KTP sudah ada di ponsel Anda."
            icon={<Images aria-hidden className="size-5" strokeWidth={2} />}
          />
        </div>
      </div>
    );
  }

  if (view === "camera") {
    return (
      <div className="flex min-h-[60dvh] flex-col md:min-h-0 md:space-y-6">
        <CustomCamera
          mode={mode}
          onPick={onKtpChange}
          onBack={() => {
            setView("source");
            setOcrError(null);
          }}
        />
      </div>
    );
  }

  if (view === "review") {
    return (
      <div className="flex min-h-[60dvh] flex-col gap-4 md:block md:min-h-0 md:space-y-6">
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

        {!ocrLoading && !ocrError && ocrCount > 0 && (
          <Alert tone="success">
            {ocrCount} data terisi otomatis. Sisanya Anda lengkapi sendiri.
          </Alert>
        )}

        {!ocrLoading && (
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {OCR_FIELD_ORDER.map((k) => {
              const c = ocrConfidence[k];
              const value = String(getValues(k as never) ?? "").trim();
              if (c === undefined && !value) return null;
              const sus = low(k);
              return (
                <li key={k} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-ink-muted">{FIELD_LABELS[k]}</span>
                    <span
                      className={
                        k === "nik"
                          ? "block break-words font-mono text-base font-semibold tabular-nums tracking-wide text-ink"
                          : "block break-words text-base font-semibold text-ink"
                      }
                    >
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

        <div className="cta-dock sticky bottom-0 -mx-1 mt-auto flex gap-3 border-t border-border p-3 md:mt-0 md:rounded-t-xl md:bg-surface md:shadow-raised">
          <Button
            variant="secondary"
            className="flex-none"
            onClick={() => {
              setView("camera");
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
    <form
      noValidate
      onSubmit={onSubmit}
      className="flex min-h-[60dvh] flex-col space-y-6 md:block md:min-h-0"
      aria-busy={isSubmitting}
    >
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
            rootChoice={rootChoice}
            hasKtp={Boolean(ktpValue)}
            ktpSrc={ktpValue ? String(ktpValue) : undefined}
            error={opt("ktp")}
            onChange={onKtpChange}
            onGanti={rootChoice === "manual" ? undefined : () => setView("camera")}
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
            <Field id="province" label="Provinsi" required error={regionError.province ?? opt("province")}>
              <SearchSelect
                id="province"
                options={PROVINCE_OPTIONS}
                value={provinceCode}
                placeholder="Pilih provinsi"
                invalid={Boolean(regionError.province || opt("province"))}
                describedBy={regionError.province || opt("province") ? "province-error" : undefined}
                onValueChange={(code) => {
                  setProvinceCode(code);
                  // Provinsi ganti -> kabupaten di-reset, nama lama tak valid lagi.
                  setRegencyCode("");
                  setValue("city", "", { shouldValidate: false });
                  const name = code ? PROVINCE_OPTIONS.find((o) => o.value === code)?.label ?? "" : "";
                  setValue("province", name, { shouldValidate: false });
                  setRegionError((prev) => ({ ...prev, province: undefined, city: undefined }));
                  clearOcr("province");
                  clearOcr("city");
                }}
              />
            </Field>
            <Field id="city" label="Kabupaten/Kota" required error={regionError.city ?? opt("city")}>
              <SearchSelect
                id="city"
                options={regencyOptions(provinceCode)}
                value={regencyCode}
                disabled={!provinceCode}
                placeholder={provinceCode ? "Pilih kabupaten/kota" : "Pilih provinsi dulu"}
                invalid={Boolean(regionError.city || opt("city"))}
                describedBy={regionError.city || opt("city") ? "city-error" : undefined}
                onValueChange={(code) => {
                  setRegencyCode(code);
                  const name = code ? regencyOptions(provinceCode).find((o) => o.value === code)?.label ?? "" : "";
                  setValue("city", name, { shouldValidate: false });
                  setRegionError((prev) => ({ ...prev, city: undefined }));
                  clearOcr("city");
                }}
              />
            </Field>
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
          <div className="space-y-6 rounded-2xl border border-border bg-primary-soft/40 p-4">
            <h3 className="text-base font-semibold text-ink">Sandi keanggotaan</h3>
            <Field
              id="password"
              label="Sandi"
              required
              hint="Minimal 8 karakter. Dipakai untuk masuk ke halaman anggota lewat NIK."
              error={passwordError}
            >
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError(undefined);
                }}
                aria-required="true"
                aria-invalid={passwordError ? true : undefined}
                aria-describedby={passwordError ? "password-error" : "password-hint"}
                className={`h-11 ${controlClass} px-3 ${controlState(passwordError)}`}
              />
            </Field>
            <Field
              id="confirmPassword"
              label="Ulangi sandi"
              required
              error={passwordError}
            >
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setPasswordError(undefined);
                }}
                aria-required="true"
                aria-invalid={passwordError ? true : undefined}
                aria-describedby={passwordError ? "confirmPassword-error" : undefined}
                className={`h-11 ${controlClass} px-3 ${controlState(passwordError)}`}
              />
            </Field>
          </div>
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

      <div className="cta-dock sticky bottom-0 -mx-1 mt-auto flex gap-3 border-t border-border p-3 md:mt-0 md:rounded-t-xl md:bg-surface md:shadow-raised">
        <Button
          variant="secondary"
          className="flex-none"
          onClick={step > 0 ? prevStep : () => setView(rootChoice === "manual" ? "choice" : "camera")}
          disabled={isSubmitting}
        >
          Kembali
        </Button>
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
      className="flex w-full items-start gap-3 rounded-xl border border-control-border bg-surface p-4 text-left transition-colors hover:border-primary hover:bg-primary-soft/40"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold text-ink">{title}</span>
        <span className="block text-sm text-ink-muted">{body}</span>
      </span>
      {badge && (
        <span className="shrink-0 rounded-[3px] bg-primary-soft px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary-ink">
          {badge}
        </span>
      )}
    </button>
  );
}

/**
 * KTP opsional kalau jalur tidak-upload, wajib kalau upload.
 * rootChoice menentukan perilaku:
 * - upload: required + OCR otomatis, ganti foto via kamera custom
 * - manual: opsional, file picker biasa, tanpa OCR
 */
function KtpField({
  rootChoice,
  hasKtp,
  ktpSrc,
  error,
  onChange,
  onGanti,
}: {
  rootChoice: RootChoice;
  hasKtp: boolean;
  ktpSrc?: string;
  error?: string;
  onChange: (file: File | undefined) => void;
  onGanti?: () => void;
}) {
  const required = rootChoice === "upload";

  if (hasKtp) {
    return (
      <Field id="ktp" label="Foto KTP" required={required} error={error}>
        <div className="space-y-2">
          {ktpSrc && (
            // eslint-disable-next-line @next/next/no-img-element -- data URL base64 dari FileReader, bukan aset Next.
            <img
              src={ktpSrc}
              alt="Pratinjau foto KTP"
              className="max-h-40 w-full rounded-xl border border-border object-cover"
            />
          )}
          <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
            <Check aria-hidden className="size-4 shrink-0" strokeWidth={2.5} />
            Foto KTP sudah dilampirkan.
          </p>
          {onGanti && (
            <button
              type="button"
              onClick={onGanti}
              className="min-h-11 rounded-[4px] px-1 text-sm font-semibold text-primary underline underline-offset-2"
            >
              Ganti foto
            </button>
          )}
          {!onGanti && (
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="min-h-11 rounded-[4px] px-1 text-sm font-medium text-danger underline underline-offset-2"
            >
              Hapus foto
            </button>
          )}
        </div>
      </Field>
    );
  }

  const hint = required
    ? "Wajib. Foto dari sini membuat data terisi otomatis via OCR."
    : "Opsional. Kalau ada foto KTP, lampirkan — tapi data tetap Anda isi manual.";

  return (
    <Field id="ktp" label="Foto KTP" required={required} hint={hint} error={error}>
      {required ? (
        <button
          type="button"
          onClick={onGanti}
          className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-[4px] border border-control-border bg-surface text-base font-medium text-ink hover:bg-bg ${controlState(error)}`}
        >
          <Camera aria-hidden className="size-5" strokeWidth={2} />
          Ambil / pilih foto KTP
        </button>
      ) : (
        <input
          id="ktp"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-invalid={error ? true : undefined}
          aria-describedby="ktp-hint ktp-error"
          onChange={(e) => onChange(e.target.files?.[0])}
          className={`h-11 ${controlClass} file:mr-3 file:h-full file:border-0 file:bg-surface file:px-3 file:text-base file:text-ink ${controlState(error)}`}
        />
      )}
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
    <fieldset className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6 lg:p-8">
      <legend className="px-1 text-lg font-semibold text-ink">
        <span aria-hidden="true" className="mr-2 inline-block size-2 rounded-[1px] bg-accent align-middle" />
        {n}. {title}
      </legend>
      <div className="mt-4 space-y-6">{children}</div>
    </fieldset>
  );
}
