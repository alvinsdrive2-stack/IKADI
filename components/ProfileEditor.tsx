"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { Alert } from "@/components/Alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect } from "@/components/ui/search-select";
import {
  BLOOD_OPTIONS,
  EDUCATION_OPTIONS,
  GENDER_LABELS,
  MARITAL_OPTIONS,
} from "@/components/constants";

/** Bentuk data yang boleh disunting admin; cocok dengan `adminProfileSchema`. */
export type EditableProfile = {
  fullName: string;
  whatsapp: string;
  birthPlace: string;
  birthDate: string;
  gender: string;
  maritalStatus: string | null;
  bloodType: string | null;
  addressKtp: string | null;
  addressCurrent: string | null;
  occupation: string;
  lastEducation: string | null;
  studyField: string | null;
  expertise: string | null;
};

const GENDER_OPTIONS = Object.entries(GENDER_LABELS).map(([value, label]) => ({ value, label }));

function toForm(p: EditableProfile) {
  // Alamat dianggap sama dengan KTP kalau kosong atau isinya identik; itu
  // kondisi awal yang paling jujur untuk data hasil impor.
  const same = !p.addressCurrent?.trim() || p.addressCurrent.trim() === (p.addressKtp ?? "").trim();
  return {
    fullName: p.fullName,
    whatsapp: p.whatsapp,
    birthPlace: p.birthPlace,
    birthDate: p.birthDate,
    gender: p.gender,
    maritalStatus: p.maritalStatus ?? "",
    bloodType: p.bloodType ?? "",
    addressKtp: p.addressKtp ?? "",
    addressSameAsKtp: same,
    addressCurrent: same ? "" : (p.addressCurrent ?? ""),
    occupation: p.occupation,
    lastEducation: p.lastEducation ?? "",
    studyField: p.studyField ?? "",
    expertise: p.expertise ?? "",
  };
}

/**
 * Form sunting data pribadi peserta. Dipakai inline di halaman detail admin,
 * jadi tidak perlu pindah halaman untuk membetulkan satu salah ketik.
 */
export function ProfileEditor({
  participantId,
  apiBase,
  endpoint,
  initial,
  onCancel,
  onSaved,
}: {
  participantId: string;
  apiBase: string;
  /** Endpoint lengkap. Kalau diisi, `apiBase`/`participantId` diabaikan. */
  endpoint?: string;
  initial: EditableProfile;
  onCancel: () => void;
  onSaved: (patch: EditableProfile) => void;
}) {
  const [form, setForm] = useState(() => toForm(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof typeof form>(k: K) => (v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setNotice(null);
    setErrors({});
    try {
      const res = await fetch(endpoint ?? `${apiBase}/${encodeURIComponent(participantId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          ...form,
          maritalStatus: form.maritalStatus || null,
          bloodType: form.bloodType || null,
          lastEducation: form.lastEducation || undefined,
          studyField: form.studyField || undefined,
          expertise: form.expertise || undefined,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        if (body?.errors) setErrors(body.errors as Record<string, string>);
        setNotice(String(body?.message ?? "Gagal menyimpan. Coba lagi."));
        return;
      }
      onSaved({
        fullName: form.fullName,
        whatsapp: form.whatsapp,
        birthPlace: form.birthPlace,
        birthDate: form.birthDate,
        gender: form.gender,
        maritalStatus: form.maritalStatus || null,
        bloodType: form.bloodType || null,
        addressKtp: form.addressKtp,
        addressCurrent: form.addressSameAsKtp ? form.addressKtp : form.addressCurrent,
        occupation: form.occupation,
        lastEducation: form.lastEducation || null,
        studyField: form.studyField || null,
        expertise: form.expertise || null,
      });
    } catch {
      setNotice("Koneksi bermasalah. Coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {notice && <Alert tone="error">{notice}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nama lengkap & gelar" htmlFor="pe-name" error={errors.fullName} span={2}>
          <Input id="pe-name" value={form.fullName} onChange={(e) => set("fullName")(e.target.value)} required />
        </Field>

        <Field label="No. WhatsApp" htmlFor="pe-wa" error={errors.whatsapp}>
          <Input
            id="pe-wa"
            value={form.whatsapp}
            onChange={(e) => set("whatsapp")(e.target.value)}
            inputMode="tel"
            required
          />
        </Field>

        <Field label="Jenis kelamin" htmlFor="pe-gender" error={errors.gender}>
          <SearchSelect
            id="pe-gender"
            value={form.gender}
            onValueChange={set("gender")}
            options={GENDER_OPTIONS}
          />
        </Field>

        <Field label="Tempat lahir" htmlFor="pe-birthplace" error={errors.birthPlace}>
          <Input
            id="pe-birthplace"
            value={form.birthPlace}
            onChange={(e) => set("birthPlace")(e.target.value)}
            required
          />
        </Field>

        <Field label="Tanggal lahir" htmlFor="pe-birthdate" error={errors.birthDate}>
          <Input
            id="pe-birthdate"
            type="date"
            value={form.birthDate}
            onChange={(e) => set("birthDate")(e.target.value)}
            required
          />
        </Field>

        <Field label="Status pernikahan" htmlFor="pe-marital" error={errors.maritalStatus}>
          <SearchSelect
            id="pe-marital"
            value={form.maritalStatus}
            onValueChange={set("maritalStatus")}
            options={[{ value: "", label: "Tidak diisi" }, ...MARITAL_OPTIONS]}
          />
        </Field>

        <Field label="Golongan darah" htmlFor="pe-blood" error={errors.bloodType}>
          <SearchSelect
            id="pe-blood"
            value={form.bloodType}
            onValueChange={set("bloodType")}
            options={[{ value: "", label: "Tidak diisi" }, ...BLOOD_OPTIONS]}
          />
        </Field>

        <Field label="Alamat sesuai KTP" htmlFor="pe-ktp-address" error={errors.addressKtp} span={2}>
          <textarea
            id="pe-ktp-address"
            rows={3}
            value={form.addressKtp}
            onChange={(e) => set("addressKtp")(e.target.value)}
            className="w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            required
          />
        </Field>

        <label className="flex items-start gap-2 text-sm text-ink sm:col-span-2">
          <input
            type="checkbox"
            checked={form.addressSameAsKtp}
            onChange={(e) => set("addressSameAsKtp")(e.target.checked)}
            className="mt-0.5 size-4 rounded border-control-border"
          />
          Alamat tinggal saat ini sama dengan alamat KTP
        </label>

        {!form.addressSameAsKtp && (
          <Field
            label="Alamat tinggal saat ini"
            htmlFor="pe-current-address"
            error={errors.addressCurrent}
            span={2}
          >
            <textarea
              id="pe-current-address"
              rows={3}
              value={form.addressCurrent}
              onChange={(e) => set("addressCurrent")(e.target.value)}
              className="w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </Field>
        )}

        <Field label="Pekerjaan" htmlFor="pe-occupation" error={errors.occupation}>
          <Input
            id="pe-occupation"
            value={form.occupation}
            onChange={(e) => set("occupation")(e.target.value)}
            required
          />
        </Field>

        <Field label="Pendidikan terakhir" htmlFor="pe-education" error={errors.lastEducation}>
          <SearchSelect
            id="pe-education"
            value={form.lastEducation}
            onValueChange={set("lastEducation")}
            options={[{ value: "", label: "Tidak diisi" }, ...EDUCATION_OPTIONS.map((o) => ({ value: o, label: o }))]}
          />
        </Field>

        <Field label="Bidang studi" htmlFor="pe-study" error={errors.studyField}>
          <Input id="pe-study" value={form.studyField} onChange={(e) => set("studyField")(e.target.value)} />
        </Field>

        <Field label="Bidang keahlian" htmlFor="pe-expertise" error={errors.expertise} span={2}>
          <textarea
            id="pe-expertise"
            rows={2}
            value={form.expertise}
            onChange={(e) => set("expertise")(e.target.value)}
            className="w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </Field>
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          <X aria-hidden /> Batal
        </Button>
        <Button type="submit" loading={saving} disabled={saving}>
          <Pencil aria-hidden /> {saving ? "Menyimpan…" : "Simpan"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  span,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  span?: 1 | 2;
  children: React.ReactNode;
}) {
  return (
    <div className={span === 2 ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
      <Label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
      </Label>
      {children}
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
