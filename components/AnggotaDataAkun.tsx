"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/Alert";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { ProfileEditor, type EditableProfile } from "@/components/ProfileEditor";

type State =
  | { kind: "loading" }
  | { kind: "ok"; data: EditableProfile }
  | { kind: "unauthorized" }
  | { kind: "error" };

/**
 * Data akun milik anggota sendiri: tampil ringkas dengan tombol "Ubah".
 *
 * Memakai `ProfileEditor` yang sama dengan suntingan admin — aturan isian dan
 * tampilannya tidak boleh bercabang dua. Bedanya hanya endpoint dan bahwa
 * anggota tidak bisa menyentuh NIK maupun wilayah.
 */
export function AnggotaDataAkun() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    // Tidak ada setState sinkron di sini: state awal sudah "loading", dan
    // hasil fetch selalu datang lewat callback.
    fetch("/api/anggota/profil/data", {
      cache: "no-store",
      credentials: "same-origin",
      signal: ctrl.signal,
    })
      .then(async (res) => {
        if (res.status === 401) return setState({ kind: "unauthorized" });
        if (!res.ok) return setState({ kind: "error" });
        const body = await res.json();
        setState({ kind: "ok", data: body.data as EditableProfile });
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setState({ kind: "error" });
      });
    return () => ctrl.abort();
  }, [reloadKey]);

  useEffect(() => {
    if (state.kind === "unauthorized") router.replace("/masuk");
  }, [state, router]);

  if (state.kind === "loading") {
    return (
      <div aria-busy="true" aria-label="Memuat data akun" className="h-56 animate-pulse rounded-xl border border-border bg-white" />
    );
  }

  if (state.kind === "unauthorized") {
    return <p className="text-sm text-ink-muted">Mengalihkan ke halaman masuk…</p>;
  }

  if (state.kind === "error") {
    return (
      <Alert tone="error">
        Gagal memuat data akun.{" "}
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="ml-2 rounded-md border border-danger px-3 py-1.5 text-sm font-semibold"
        >
          Coba lagi
        </button>
      </Alert>
    );
  }

  const d = state.data;

  return (
    <section id="data-akun" className="scroll-mt-24 rounded-xl border border-border bg-white" aria-labelledby="data-akun-h">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h2 id="data-akun-h" className="text-sm font-semibold text-ink">Data akun</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Nama, kontak, dan alamat Anda sendiri. NIK dan wilayah hanya bisa diubah pengurus.
          </p>
        </div>
        {!editing && (
          <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(true)}>
            <Pencil aria-hidden /> Ubah
          </Button>
        )}
      </div>

      <div className="p-5">
        {notice && (
          <div className="mb-4">
            <Alert tone="success">{notice}</Alert>
          </div>
        )}

        {editing ? (
          <ProfileEditor
            participantId=""
            apiBase=""
            endpoint="/api/anggota/profil/data"
            initial={d}
            onCancel={() => setEditing(false)}
            onSaved={(patch) => {
              setState({ kind: "ok", data: { ...d, ...patch } });
              setEditing(false);
              setNotice("Data akun tersimpan.");
            }}
          />
        ) : (
          <dl className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
            {[
              { label: "Nama lengkap", value: d.fullName },
              { label: "No. WhatsApp", value: d.whatsapp },
              { label: "Tempat lahir", value: d.birthPlace || "-" },
              { label: "Tanggal lahir", value: d.birthDate },
              { label: "Alamat sesuai KTP", value: d.addressKtp || "-", span: true },
              { label: "Alamat tinggal", value: d.addressCurrent || d.addressKtp || "-", span: true },
              { label: "Pekerjaan", value: d.occupation || "-" },
              { label: "Pendidikan terakhir", value: d.lastEducation || "-" },
            ].map((r) => (
              <div key={r.label} className={r.span ? "sm:col-span-2" : undefined}>
                <dt className="text-xs text-ink-muted">{r.label}</dt>
                <dd className="mt-1 break-words text-sm font-medium text-ink">{r.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}
