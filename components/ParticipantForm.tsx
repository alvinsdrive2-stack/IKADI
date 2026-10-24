"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { participantSchema, PHOTO_MAX_BYTES, type ParticipantInput } from "@/lib/schema";
import { Alert } from "@/components/Alert";
import { Button } from "@/components/Button";
import { Checkbox, Field, Input, RadioGroup, Select, Textarea, controlClass, controlState } from "@/components/Field";
import { EDUCATION_OPTIONS } from "@/components/constants";

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
  photo: "",
  address: "",
  whatsapp: "",
  lastEducation: "",
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

type FieldKey = keyof ParticipantInput;

/** Urutan DOM = urutan visual (dipakai ErrorSummary). */
const FIELD_LABELS: Record<FieldKey, string> = {
  originType: "Asal IKADI",
  originName: "Nama PW/PD IKADI",
  fullName: "Nama Lengkap & Gelar",
  nik: "Nomor NIK KTP",
  birthPlace: "Tempat Lahir",
  birthDate: "Tanggal Lahir",
  gender: "Jenis Kelamin",
  photo: "Pas Foto",
  address: "Alamat",
  whatsapp: "No. WhatsApp",
  lastEducation: "Pendidikan Terakhir",
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

export function ParticipantForm() {
  const router = useRouter();
  // ref callback -> fokus tanpa akses ref di render (aturan react-hooks/refs)
  const focusOnMount = useCallback(
    (el: HTMLDivElement | null) => el?.focus(),
    [],
  );
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ field: FieldKey; message: string }[]>([]);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
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

  useEffect(() => {
    if (sermon && sermon !== "LAINNYA") setValue("sermonExperienceOther", "");
  }, [sermon, setValue]);

  const isOther = sermon === "LAINNYA";

  const onInvalid = () => {
    const items = (Object.keys(FIELD_LABELS) as FieldKey[])
      .filter((k) => errors[k] && (k !== "sermonExperienceOther" || isOther))
      .map((k) => ({ field: k, message: String(errors[k]?.message ?? "") }));
    setSummary(items);
    setGlobalError(null);
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

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-10" aria-busy={isSubmitting}>
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

      <Section n={1} title="Identitas">
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
          {...register("fullName")}
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
          {...register("nik")}
        />
      </Section>

      <Section n={2} title="Data Pribadi">
        <RadioGroup
          label="Jenis Kelamin"
          required
          name="gender"
          columns={2}
          options={GENDER_OPTIONS}
          value={gender ?? ""}
          onChange={(v) =>
            setValue("gender", v as ParticipantInput["gender"], { shouldValidate: true })
          }
          error={opt("gender")}
        />
        <div className="grid gap-6 md:grid-cols-2">
          <Input
            id="birthPlace"
            label="Tempat Lahir"
            required
            error={opt("birthPlace")}
            {...register("birthPlace")}
          />
          <Input
            id="birthDate"
            label="Tanggal Lahir"
            required
            type="date"
            error={opt("birthDate")}
            {...register("birthDate")}
          />
        </div>
        <Field id="photo" label="Pas Foto" required hint="Format JPEG, PNG, atau WebP. Maksimal 1 MB." error={opt("photo")}>
          <input
            id="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-required
            aria-invalid={errors.photo ? true : undefined}
            aria-describedby="photo-hint photo-error"
            onChange={(e) => onPhotoChange(e.target.files?.[0])}
            className={`h-11 ${controlClass} file:mr-3 file:h-full file:border-0 file:bg-surface file:px-3 file:text-base file:text-ink ${controlState(opt("photo"))}`}
          />
        </Field>
        <Textarea
          id="address"
          label="Alamat"
          required
          rows={3}
          hint="Desa/Kelurahan, Kecamatan, Kabupaten/Kota, Provinsi."
          error={opt("address")}
          {...register("address")}
        />
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
      </Section>

      <Section n={3} title="Latar Belakang">
        <div className="grid gap-6 md:grid-cols-2">
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
          <Input
            id="occupation"
            label="Pekerjaan"
            required
            error={opt("occupation")}
            {...register("occupation")}
          />
        </div>
        <Input
          id="expertise"
          label="Bidang Keahlian"
          hint="Opsional."
          error={opt("expertise")}
          {...register("expertise")}
        />
      </Section>

      <Section n={4} title="Pengalaman">
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
      </Section>

      <Section n={5} title="Motivasi">
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
      </Section>

      <Section n={6} title="Persetujuan">
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
      </Section>

      <div className="space-y-4">
        {globalError && (
          <div key={globalError} ref={focusOnMount} tabIndex={-1}>
            <Alert tone="error">{globalError}</Alert>
          </div>
        )}
        <Button
          type="submit"
          disabled={isSubmitting}
          loading={isSubmitting}
          className="w-full min-w-40 sm:w-auto"
        >
          {isSubmitting ? "Mengirim..." : "Kirim Data"}
        </Button>
        <p className="text-sm text-ink-muted">
          Kolom bertanda{" "}
          <span className="text-primary" aria-hidden>
            *
          </span>{" "}
          wajib diisi.
        </p>
      </div>
    </form>
  );
}

function Section({
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
