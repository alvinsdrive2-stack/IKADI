"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/Alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Status = { needsProfileCompletion: boolean };

/**
 * Halaman pelengkapan profil untuk peserta hasil impor.
 *
 * Peserta masuk memakai sandi sementara (`Munas` + tanggal lahir dari NIK),
 * lalu di sini wajib mengisi data yang tidak ada di sumber impor dan membuat
 * sandi baru. Setelah selesai penanda `needsProfileCompletion` dimatikan, jadi
 * sandi tidak bisa diganti lewat jalur ini lagi.
 */
export function ProfileCompletion() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    birthPlace: "",
    addressKtp: "",
    addressSameAsKtp: true,
    addressCurrent: "",
    occupation: "",
    password: "",
    passwordConfirm: "",
  });

  useEffect(() => {
    let alive = true;
    fetch("/api/anggota/profil/status", { cache: "no-store", credentials: "same-origin" })
      .then(async (r) => {
        if (!alive) return;
        if (r.status === 401) return router.replace("/masuk");
        const body = await r.json().catch(() => null);
        const data = body?.data as Status | undefined;
        if (data && data.needsProfileCompletion === false) setAlreadyDone(true);
      })
      .catch(() => {})
      .finally(() => alive && setChecking(false));
    return () => {
      alive = false;
    };
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.passwordConfirm) {
      setErrors({ passwordConfirm: "Konfirmasi sandi tidak sama." });
      return;
    }
    setSaving(true);
    setNotice(null);
    setErrors({});
    try {
      const res = await fetch("/api/anggota/profil/lengkapi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          birthPlace: form.birthPlace,
          addressKtp: form.addressKtp,
          addressSameAsKtp: form.addressSameAsKtp,
          addressCurrent: form.addressSameAsKtp ? undefined : form.addressCurrent,
          occupation: form.occupation,
          password: form.password,
        }),
      });
      const body = await res.json().catch(() => null);
      if (res.status === 401) return router.replace("/masuk");
      if (!res.ok) {
        if (body?.errors) setErrors(body.errors as Record<string, string>);
        setNotice(String(body?.message ?? "Gagal menyimpan. Coba lagi."));
        return;
      }
      setNotice("Profil lengkap. Mengalihkan…");
      router.replace("/anggota");
      router.refresh();
    } catch {
      setNotice("Koneksi bermasalah. Coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  if (checking) {
    return <div aria-busy="true" className="h-64 animate-pulse rounded-xl border border-border bg-white" />;
  }

  if (alreadyDone) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Profil sudah lengkap</h1>
        <p className="text-sm text-ink-muted">Tidak ada yang perlu dilengkapi.</p>
        <Button onClick={() => router.replace("/anggota")}>Ke dasbor</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Lengkapi profil</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
          Data Anda berasal dari pendataan MUNAS, jadi sebagian belum lengkap. Lengkapi
          sekali di sini dan buat sandi baru untuk menggantikan sandi sementara.
        </p>
      </header>

      {notice && <Alert tone="error">{notice}</Alert>}

      <form onSubmit={submit} noValidate className="space-y-5 rounded-xl border border-border bg-white p-5">
        <div className="space-y-1.5">
          <Label htmlFor="pc-birthplace" className="block text-sm font-medium text-ink">
            Tempat lahir <span className="text-primary">*</span>
          </Label>
          <Input
            id="pc-birthplace"
            value={form.birthPlace}
            onChange={(e) => setForm((f) => ({ ...f, birthPlace: e.target.value }))}
            aria-invalid={errors.birthPlace ? true : undefined}
            required
          />
          {errors.birthPlace && <p className="text-sm font-medium text-danger">{errors.birthPlace}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pc-address" className="block text-sm font-medium text-ink">
            Alamat sesuai KTP <span className="text-primary">*</span>
          </Label>
          <textarea
            id="pc-address"
            rows={3}
            value={form.addressKtp}
            onChange={(e) => setForm((f) => ({ ...f, addressKtp: e.target.value }))}
            className="w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-invalid={errors.addressKtp ? true : undefined}
            required
          />
          {errors.addressKtp && <p className="text-sm font-medium text-danger">{errors.addressKtp}</p>}
        </div>

        <label className="flex items-start gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={form.addressSameAsKtp}
            onChange={(e) => setForm((f) => ({ ...f, addressSameAsKtp: e.target.checked }))}
            className="mt-0.5 size-4 rounded border-control-border"
          />
          Alamat tinggal saat ini sama dengan alamat KTP
        </label>

        {!form.addressSameAsKtp && (
          <div className="space-y-1.5">
            <Label htmlFor="pc-address-current" className="block text-sm font-medium text-ink">
              Alamat tinggal saat ini <span className="text-primary">*</span>
            </Label>
            <textarea
              id="pc-address-current"
              rows={3}
              value={form.addressCurrent}
              onChange={(e) => setForm((f) => ({ ...f, addressCurrent: e.target.value }))}
              className="w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-invalid={errors.addressCurrent ? true : undefined}
              required
            />
            {errors.addressCurrent && <p className="text-sm font-medium text-danger">{errors.addressCurrent}</p>}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="pc-occupation" className="block text-sm font-medium text-ink">
            Pekerjaan <span className="text-primary">*</span>
          </Label>
          <Input
            id="pc-occupation"
            value={form.occupation}
            onChange={(e) => setForm((f) => ({ ...f, occupation: e.target.value }))}
            aria-invalid={errors.occupation ? true : undefined}
            required
          />
          {errors.occupation && <p className="text-sm font-medium text-danger">{errors.occupation}</p>}
        </div>

        <div className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pc-password" className="block text-sm font-medium text-ink">
              Sandi baru <span className="text-primary">*</span>
            </Label>
            <Input
              id="pc-password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              aria-invalid={errors.password ? true : undefined}
              required
            />
            {errors.password && <p className="text-sm font-medium text-danger">{errors.password}</p>}
            <p className="text-xs text-ink-muted">Minimal 8 karakter.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pc-password2" className="block text-sm font-medium text-ink">
              Ulangi sandi baru <span className="text-primary">*</span>
            </Label>
            <Input
              id="pc-password2"
              type="password"
              autoComplete="new-password"
              value={form.passwordConfirm}
              onChange={(e) => setForm((f) => ({ ...f, passwordConfirm: e.target.value }))}
              aria-invalid={errors.passwordConfirm ? true : undefined}
              required
            />
            {errors.passwordConfirm && <p className="text-sm font-medium text-danger">{errors.passwordConfirm}</p>}
          </div>
        </div>

        <Button type="submit" loading={saving} disabled={saving}>
          Simpan dan buat sandi
        </Button>
      </form>
    </div>
  );
}
