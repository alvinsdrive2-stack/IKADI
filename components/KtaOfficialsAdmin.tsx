"use client";

/**
 * CRUD nama pejabat penanda tangan KTA (Ketua Umum & Sekjen).
 * GET/PATCH /api/admin/kta/pejabat. Nama ini yang tampil di blok TTD kartu,
 * halaman verifikasi publik, dan halaman kartu anggota.
 */

import { useEffect, useState } from "react";
import { Check, Save, UserRound } from "lucide-react";
import { SessionExpired } from "@/components/AdminNav";
import { Alert } from "@/components/Alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Key = "ketuaUmum" | "sekjen";
type Official = { key: Key; nama: string; jabatan: string };
type Data = { ketuaUmum: Official; sekjen: Official; savedInDb: boolean; updatedAt: string | null };
type Draft = Record<Key, { nama: string; jabatan: string }>;

type State =
  | { kind: "loading" }
  | { kind: "ok"; data: Data }
  | { kind: "unauthorized" }
  | { kind: "error" };

const ORDER: { key: Key; title: string; hint: string }[] = [
  { key: "ketuaUmum", title: "Ketua Umum", hint: "Tampil di blok tanda tangan kanan kartu." },
  { key: "sekjen", title: "Sekretaris Jenderal", hint: "Tampil di blok tanda tangan kiri kartu." },
];

function toDraft(d: Data): Draft {
  return {
    ketuaUmum: { nama: d.ketuaUmum.nama, jabatan: d.ketuaUmum.jabatan },
    sekjen: { nama: d.sekjen.nama, jabatan: d.sekjen.jabatan },
  };
}

export function KtaOfficialsAdmin() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/admin/kta/pejabat", { signal: ctrl.signal, cache: "no-store", credentials: "same-origin" })
      .then(async (res) => {
        if (res.status === 401) return setState({ kind: "unauthorized" });
        if (!res.ok) return setState({ kind: "error" });
        const body = await res.json();
        const data = body.data as Data;
        setState({ kind: "ok", data });
        setDraft(toDraft(data));
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setState({ kind: "error" });
      });
    return () => ctrl.abort();
  }, []);

  if (state.kind === "unauthorized") return <SessionExpired />;

  if (state.kind === "loading") {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Memuat nama pejabat">
        <div className="h-32 animate-pulse rounded-xl border border-border bg-white" />
        <div className="h-32 animate-pulse rounded-xl border border-border bg-white" />
      </div>
    );
  }

  if (state.kind === "error") {
    return <Alert tone="error">Gagal memuat nama pejabat. Muat ulang halaman untuk mencoba lagi.</Alert>;
  }

  const data = state.data;
  const base = byDraft(data);
  const current = draft ?? base;

  const dirty =
    current.ketuaUmum.nama !== base.ketuaUmum.nama ||
    current.ketuaUmum.jabatan !== base.ketuaUmum.jabatan ||
    current.sekjen.nama !== base.sekjen.nama ||
    current.sekjen.jabatan !== base.sekjen.jabatan;

  function setField(key: Key, field: "nama" | "jabatan", value: string) {
    setDraft((d) => {
      const prev = d ?? base;
      return { ...prev, [key]: { ...prev[key], [field]: value } };
    });
    setSaved(false);
    setMessage(null);
  }

  async function save() {
    const d = draft ?? base;
    setSaving(true);
    setErrors({});
    setMessage(null);
    try {
      const res = await fetch("/api/admin/kta/pejabat", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          ketuaUmum: { nama: d.ketuaUmum.nama.trim(), jabatan: d.ketuaUmum.jabatan.trim() },
          sekjen: { nama: d.sekjen.nama.trim(), jabatan: d.sekjen.jabatan.trim() },
        }),
      });
      if (res.status === 401) return setState({ kind: "unauthorized" });
      const body = await res.json().catch(() => null);
      if (res.status === 400 && body?.errors) {
        setErrors(body.errors as Record<string, string>);
        setMessage(body.message ?? "Periksa kembali isian Anda.");
        return;
      }
      if (!res.ok || !body?.data) {
        setMessage("Gagal menyimpan. Coba lagi.");
        return;
      }
      const next = body.data as Data;
      setState({ kind: "ok", data: next });
      setDraft(toDraft(next));
      setSaved(true);
    } catch {
      setMessage("Gagal menyimpan. Periksa koneksi lalu coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {!data.savedInDb && (
        <Alert tone="info">
          Nama masih memakai nilai default dari konfigurasi server. Simpan sekali untuk menguncinya di database.
        </Alert>
      )}
      {message && <Alert tone="error">{message}</Alert>}
      {saved && (
        <Alert tone="success">
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <Check aria-hidden className="size-4" /> Tersimpan
          </span>{" "}
          Nama baru langsung dipakai di kartu berikutnya.
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {ORDER.map(({ key, title, hint }) => {
          const v = current[key];
          return (
            <section key={key} className="rounded-xl border border-border bg-white">
              <div className="flex items-start gap-2 border-b border-border px-5 py-4">
                <UserRound aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-ink">{title}</h2>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{hint}</p>
                </div>
              </div>
              <div className="space-y-4 p-5">
                <label className="block">
                  <span className="text-xs text-ink-muted">Nama lengkap &amp; gelar</span>
                  <Input
                    className="mt-1"
                    value={v.nama}
                    maxLength={200}
                    onChange={(e) => setField(key, "nama", e.target.value)}
                    aria-invalid={Boolean(errors[`${key}.nama`])}
                    aria-describedby={errors[`${key}.nama`] ? `${key}-nama-error` : undefined}
                  />
                  {errors[`${key}.nama`] && (
                    <span id={`${key}-nama-error`} className="mt-1 block text-xs font-medium text-danger">
                      {errors[`${key}.nama`]}
                    </span>
                  )}
                </label>
                <label className="block">
                  <span className="text-xs text-ink-muted">Jabatan (teks di atas nama)</span>
                  <Input
                    className="mt-1"
                    value={v.jabatan}
                    maxLength={120}
                    onChange={(e) => setField(key, "jabatan", e.target.value)}
                    aria-invalid={Boolean(errors[`${key}.jabatan`])}
                  />
                  {errors[`${key}.jabatan`] && (
                    <span className="mt-1 block text-xs font-medium text-danger">{errors[`${key}.jabatan`]}</span>
                  )}
                </label>
              </div>
            </section>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-white px-5 py-4">
        <Button onClick={save} loading={saving} disabled={!dirty}>
          <Save aria-hidden /> {saving ? "Menyimpan…" : "Simpan nama pejabat"}
        </Button>
        <span className="text-sm text-ink-muted">
          {dirty ? "Ada perubahan belum disimpan." : "Tidak ada perubahan."}
        </span>
        <span className="ml-auto text-xs text-ink-muted">
          Terakhir disimpan:{" "}
          {data.updatedAt
            ? new Date(data.updatedAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })
            : "belum pernah"}
        </span>
      </div>
    </div>
  );
}

function byDraft(d: Data): Draft {
  return toDraft(d);
}
