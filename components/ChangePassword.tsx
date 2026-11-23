"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/Alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Ganti sandi anggota.
 *
 * Dipakai dua konteks: dipaksa setelah sandi direset ke tanggal lahir
 * (`mustChangePassword = true`), atau dibuka sendiri kapan saja. Sandi lama
 * selalu diminta, jadi sesi yang tertinggal di perangkat bersama tidak cukup
 * untuk mengambil alih akun.
 */
export function ChangePassword({
  meUrl = "/api/anggota/me",
  endpoint = "/api/anggota/sandi",
  forcedWhen,
  title = "Ganti sandi",
  forcedText = "Sandi Anda masih tanggal lahir. Buat sandi sendiri sekarang supaya akun tidak bisa dibuka orang lain.",
  redirectTo = "/anggota",
}: {
  /** Sumber status wajib-ganti-sandi. */
  meUrl?: string;
  /** Endpoint POST ganti sandi. */
  endpoint?: string;
  /** Pembaca penanda "wajib ganti" dari body `meUrl`; null = tidak pernah dipaksa. */
  forcedWhen?: (data: Record<string, unknown> | null) => boolean;
  title?: string;
  /** Kalimat ajakan saat sandi wajib diganti. */
  forcedText?: string;
  /** Halaman tujuan setelah sandi tersimpan. */
  redirectTo?: string;
}) {
  const router = useRouter();
  const [forced, setForced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    currentPassword: "",
    password: "",
    passwordConfirm: "",
  });

  useEffect(() => {
    let alive = true;
    fetch(meUrl, { cache: "no-store", credentials: "same-origin" })
      .then(async (r) => {
        if (!alive) return;
        if (r.status === 401) return router.replace("/masuk");
        const body = await r.json().catch(() => null);
        setForced(forcedWhen ? forcedWhen(body?.data ?? null) : false);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [router, meUrl, forcedWhen]);

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
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          currentPassword: form.currentPassword,
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
      setNotice("Sandi tersimpan. Mengalihkan…");
      router.replace(redirectTo);
      router.refresh();
    } catch {
      setNotice("Koneksi bermasalah. Coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
          {forced ? forcedText : "Masukkan sandi saat ini, lalu tentukan sandi baru."}
        </p>
      </header>

      {notice && <Alert tone="error">{notice}</Alert>}

      <form onSubmit={submit} noValidate className="space-y-5 rounded-xl border border-border bg-white p-5">
        <div className="space-y-1.5">
          <Label htmlFor="cp-current" className="block text-sm font-medium text-ink">
            Sandi saat ini <span className="text-primary">*</span>
          </Label>
          <Input
            id="cp-current"
            type="password"
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
            aria-invalid={errors.currentPassword ? true : undefined}
            required
          />
          {errors.currentPassword && (
            <p className="text-sm font-medium text-danger">{errors.currentPassword}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cp-new" className="block text-sm font-medium text-ink">
            Sandi baru <span className="text-primary">*</span>
          </Label>
          <Input
            id="cp-new"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby="cp-new-hint"
            required
          />
          <p id="cp-new-hint" className="text-xs text-ink-muted">Minimal 8 karakter.</p>
          {errors.password && <p className="text-sm font-medium text-danger">{errors.password}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cp-confirm" className="block text-sm font-medium text-ink">
            Ulangi sandi baru <span className="text-primary">*</span>
          </Label>
          <Input
            id="cp-confirm"
            type="password"
            autoComplete="new-password"
            value={form.passwordConfirm}
            onChange={(e) => setForm((f) => ({ ...f, passwordConfirm: e.target.value }))}
            aria-invalid={errors.passwordConfirm ? true : undefined}
            required
          />
          {errors.passwordConfirm && (
            <p className="text-sm font-medium text-danger">{errors.passwordConfirm}</p>
          )}
        </div>

        <Button type="submit" loading={saving} disabled={saving} className="w-full">
          {saving ? "Menyimpan…" : "Simpan sandi baru"}
        </Button>
      </form>
    </div>
  );
}
