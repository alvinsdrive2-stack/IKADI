"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Printer, ShieldCheck } from "lucide-react";
import { SessionExpired } from "@/components/AdminNav";
import { Alert } from "@/components/Alert";
import { PageBanner } from "@/components/PageBanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KtaStepper } from "@/components/ui/stepper";
import { KtaCardView, type KtaCardData } from "@/components/KtaCardView";
import { compactPersonName } from "@/lib/person-name";
import { LEVEL_LABELS } from "@/lib/member-number";
import { SearchSelect } from "@/components/ui/search-select";
import { cn } from "@/lib/utils";
import { displayMemberNumber } from "@/lib/member-number";

type KtaData = KtaCardData & {
  issued: boolean;
  /** Level terkunci karena nomor sudah terbit -> pilihan level diabaikan. */
  levelLocked?: boolean;
};
type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; data: KtaData }
  | { kind: "notfound" }
  | { kind: "unauthorized" }
  | { kind: "ineligible"; message: string }
  | { kind: "error" };

const STEPS = [
  { label: "Terdaftar", desc: "Data tersimpan" },
  { label: "Verifikasi admin", desc: "Diperiksa pengurus" },
  { label: "KTA terbit", desc: "Nomor + QR aktif" },
];

export function KtaCard({
  id,
  apiBase = "/api/admin/participants",
  basePath = "/admin/peserta",
  allowedLevels,
}: {
  id: string;
  apiBase?: string;
  basePath?: string;
  /** Level yang boleh ditetapkan saat mencetak. Kosong = level peserta apa adanya. */
  allowedLevels?: number[];
}) {
  const [state, setState] = useState<State>({ kind: "idle" });
  // Level yang akan ditetapkan saat nomor diterbitkan. Kosong = pakai level peserta.
  const [levelCode, setLevelCode] = useState<string>("");

  async function cetak() {
    setState({ kind: "loading" });
    try {
      const res = await fetch(`${apiBase}/${encodeURIComponent(id)}/kta`, {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(levelCode ? { levelCode: Number(levelCode) } : {}),
      });
      if (res.status === 401) return setState({ kind: "unauthorized" });
      if (res.status === 404) return setState({ kind: "notfound" });
      const body = await res.json().catch(() => null);
      if (res.status === 409 && body?.code === "NOT_ELIGIBLE") return setState({ kind: "ineligible", message: body.message });
      if (!res.ok || !body?.data) return setState({ kind: "error" });
      setState({ kind: "ok", data: body.data });
    } catch {
      setState({ kind: "error" });
    }
  }

  const compact = useCallback((s: string) => compactPersonName(s), []);

  const levelOptions = (allowedLevels ?? []).map((l) => ({
    value: String(l),
    label: `${l}, ${LEVEL_LABELS[l] ?? l}`,
  }));

  if (state.kind === "unauthorized") return <SessionExpired />;

  // ---------- Belum terbit ----------
  if (state.kind === "idle" || state.kind === "loading") {
    const busy = state.kind === "loading";
    return (
      <div className="kta-screen-only space-y-5">
        <PageBanner
          headingId="page-h"
          title="Cetak Kartu Tanda Anggota"
          description="Nomor anggota terbit sekali dan berlaku permanen. Cetak ulang setelahnya gratis."
          image="/ornaments/2.svg"
          back={{ href: `${basePath}/${id}`, label: "Kembali ke detail peserta" }}
          action={
            <Button onClick={cetak} disabled={busy} loading={busy}>
              <Printer aria-hidden /> {busy ? "Menerbitkan nomor…" : "Terbitkan & cetak KTA"}
            </Button>
          }
        />

        {levelOptions.length > 0 && (
          <section className="rounded-xl border border-border bg-white p-5">
            <h2 className="text-sm font-semibold text-ink">Level saat nomor terbit</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">
              Level ini tercetak di depan nomor anggota dan berlaku permanen. Kosongkan untuk memakai level peserta
              sekarang.
            </p>
            <div className="mt-3 max-w-xs">
              <SearchSelect
                id="kta-level"
                options={[{ value: "", label: "Pakai level peserta" }, ...levelOptions]}
                value={levelCode}
                disabled={busy}
                onValueChange={(v) => setLevelCode(v)}
              />
            </div>
          </section>
        )}

        <section className="rounded-xl border border-border bg-white">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold text-ink">Tahap penerbitan</h2>
            <p className="mt-1 text-sm text-ink-muted">Nomor terbit sekali dan berlaku permanen.</p>
          </div>
          <div className="space-y-5 p-5">
            <KtaStepper steps={STEPS} current={1} />
            <Alert tone="info">
              <span className="font-semibold">Nomor terbit sekali.</span> Nomor anggota diterbitkan saat kartu ini
              dicetak pertama kali dan berlaku permanen. Cetak ulang setelahnya memakai nomor yang sama.
            </Alert>
          </div>
        </section>
      </div>
    );
  }

  // ---------- Gagal ----------
  if (state.kind !== "ok") {
    const message =
      state.kind === "notfound"
        ? "Data peserta tidak ditemukan."
        : state.kind === "ineligible"
          ? state.message
          : "Gagal memuat kartu KTA.";
    const recoverable = state.kind === "error";
    return (
      <div className="kta-screen-only space-y-5">
        <PageBanner
          headingId="page-h"
          title="Cetak Kartu Tanda Anggota"
          description="Kartu belum bisa diterbitkan untuk peserta ini."
          image="/ornaments/2.svg"
          back={{ href: `${basePath}/${id}`, label: "Kembali ke detail peserta" }}
        />
        <Alert tone="error">
          {message}{" "}
          {state.kind === "ineligible" && (
            <Link
              href={`${basePath}/${id}`}
              className="ml-2 inline-flex min-h-9 items-center rounded-md border border-danger px-3 text-sm font-semibold"
            >
              Lengkapi data peserta
            </Link>
          )}
          {recoverable && (
            <button
              type="button"
              onClick={cetak}
              className="ml-2 inline-flex min-h-9 items-center rounded-md border border-danger px-3 text-sm font-semibold"
            >
              Coba lagi
            </button>
          )}
        </Alert>
      </div>
    );
  }

  const d = state.data;

  return (
    <div className="space-y-5">
      <div className="kta-screen-only space-y-4">
        <PageBanner
          headingId="page-h"
          title={d.fullName}
          description="Kartu tanda anggota IKADI. Periksa tampilan, lalu cetak atau simpan sebagai PDF."
          image="/ornaments/2.svg"
          back={{ href: `${basePath}/${id}`, label: "Kembali ke detail peserta" }}
          badge={
            <>
              <Badge variant="success">KTA terbit</Badge>
              <span className="font-mono text-sm font-semibold tracking-wide text-ink">{displayMemberNumber(d.memberNumber)}</span>
            </>
          }
          action={
            <Button onClick={() => window.print()}>
              <Printer aria-hidden /> Cetak / simpan PDF
            </Button>
          }
        />

        <section className="rounded-xl border border-border bg-white px-5 py-5">
          <KtaStepper steps={STEPS} current={2} />
        </section>

        <div className="grid gap-3 sm:grid-cols-2">
          <InfoTile
            title="Status nomor"
            value={d.issued ? "Baru terbit" : "Sudah ada"}
            note={d.issued ? "Nomor permanen diterbitkan di cetakan ini." : "Nomor lama dipakai ulang, tetap permanen."}
          />
          <InfoTile
            title="Ukuran & bahan"
            value="85,6 mm"
            note="Kertas 230–260 gsm, lalu laminasi."
          />
        </div>

      </div>

      {/* Satu-satunya pratinjau: markup yang sama dipakai saat print, jadi layar == hasil cetak. */}
      <div className="kta-print-reset rounded-xl border border-border bg-bg p-4 sm:p-6">
        <KtaCardView data={d} />
      </div>

      <section className="kta-screen-only rounded-xl border border-border bg-white">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <ShieldCheck aria-hidden className="size-4 text-primary" />
          <h2 className="text-sm font-semibold text-ink">Tautan verifikasi</h2>
        </div>
        <div className="space-y-2 p-5 text-sm">
          <p className="break-all font-mono text-xs text-ink-muted">{d.verifyUrl}</p>
          <p className="leading-relaxed text-ink-muted">
            QR di kedua blok tanda tangan membuka halaman verifikasi resmi berisi nama, nomor anggota, dan status
            keanggotaan.
          </p>
        </div>
      </section>
    </div>
  );
}

function InfoTile({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-border bg-white px-4 py-4">
      <p className="text-xs text-ink-muted">{title}</p>
      <p className="mt-1 text-lg font-semibold leading-tight text-ink">{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-ink-muted">{note}</p>
    </div>
  );
}

