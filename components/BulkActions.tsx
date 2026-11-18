"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileImage, FileText, Printer, X } from "lucide-react";
import { Alert } from "@/components/Alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Kind = "pdf" | "jpg";

type JobState = {
  id: string;
  status: "running" | "done" | "failed";
  total: number;
  done: number;
  skipped: { label: string; reason: string }[];
  message: string | null;
  fileName: string | null;
};

/**
 * Panel aksi massal di atas tabel peserta: terbitkan nomor, unduh PDF/JPG
 * dalam ZIP. `selection` kosong = pakai "semua hasil filter".
 *
 * Progres diambil dengan polling karena ekspor berjalan di latar belakang
 * (render kartu per peserta bisa makan puluhan detik untuk ratusan orang).
 */
export function BulkActions({
  selected,
  filterQuery,
  issueUrl,
  exportBase,
  onClear,
  onIssued,
}: {
  /** Id peserta yang dicentang di tabel. */
  selected: string[];
  /** Query filter tabel tanpa paginasi, mis. "q=jawa&sort=newest". */
  filterQuery: string;
  /** Endpoint penerbitan massal, mis. /api/admin/bulk/terbitkan. */
  issueUrl: string;
  /** Endpoint pekerjaan ekspor (bulk/kta). */
  exportBase: string;
  onClear: () => void;
  /** Dipanggil setelah penerbitan massal selesai supaya tabel dimuat ulang. */
  onIssued: () => void;
}) {
  const [kind, setKind] = useState<Kind>("pdf");
  const [useAll, setUseAll] = useState(false);
  const [busy, setBusy] = useState<null | "issue" | "export">(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "info"; text: React.ReactNode } | null>(null);
  const [job, setJob] = useState<JobState | null>(null);
  const timer = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (timer.current !== null) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const useAllEffective = useAll || selected.length === 0;

  const filterPayload = () => {
    const params = new URLSearchParams(filterQuery);
    return {
      q: params.get("q") ?? undefined,
      education: params.get("education") ?? undefined,
      dateFrom: params.get("dateFrom") ?? undefined,
      dateTo: params.get("dateTo") ?? undefined,
      sort: params.get("sort") ?? "newest",
    };
  };

  const startExport = async () => {
    setBusy("export");
    setNotice(null);
    setJob(null);
    try {
      const res = await fetch(exportBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          kind,
          ...(useAllEffective ? { all: true, ...filterPayload() } : { ids: selected }),
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setNotice({ tone: "error", text: String(body?.message ?? "Gagal memulai ekspor.") });
        return;
      }
      const data = body?.data as JobState;
      setJob(data);
      stopPolling();
      timer.current = window.setInterval(async () => {
        const s = await fetch(`${exportBase}/${data.id}`, { credentials: "same-origin", cache: "no-store" });
        if (!s.ok) return;
        const sb = await s.json().catch(() => null);
        const next = sb?.data as JobState | undefined;
        if (!next) return;
        setJob(next);
        if (next.status !== "running") stopPolling();
      }, 1200);
    } catch {
      setNotice({ tone: "error", text: "Koneksi bermasalah. Coba lagi." });
    } finally {
      setBusy(null);
    }
  };

  const startIssue = async () => {
    if (useAllEffective) {
      setNotice({ tone: "error", text: "Penerbitan massal membutuhkan peserta yang dicentang." });
      return;
    }
    setBusy("issue");
    setNotice(null);
    try {
      const res = await fetch(issueUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ ids: selected }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setNotice({ tone: "error", text: String(body?.message ?? "Gagal menerbitkan nomor.") });
        return;
      }
      const d = body?.data as { issued: number; skipped: { label: string; reason: string }[] };
      setNotice({
        tone: d.skipped.length ? "info" : "success",
        text: `${d.issued} nomor diterbitkan${d.skipped.length ? `, ${d.skipped.length} dilewati` : ""}.`,
      });
      onIssued();
      onClear();
    } catch {
      setNotice({ tone: "error", text: "Koneksi bermasalah. Coba lagi." });
    } finally {
      setBusy(null);
    }
  };

  const progress = job ? Math.round((job.done / Math.max(1, job.total)) * 100) : 0;

  return (
    <section aria-labelledby="bulk-h" className="rounded-xl border border-border bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h2 id="bulk-h" className="text-sm font-semibold text-ink">
            Aksi massal
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {useAllEffective
              ? "Berlaku untuk semua peserta yang cocok dengan filter aktif."
              : `${selected.length} peserta dipilih.`}
          </p>
        </div>
        <Badge variant={useAllEffective ? "pd" : "success"}>
          {useAllEffective ? "Semua hasil filter" : `${selected.length} dipilih`}
        </Badge>
      </div>

      <div className="space-y-4 p-5">
        {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Jenis berkas" className="inline-flex rounded-lg border border-border p-0.5">
            {(
              [
                { value: "pdf" as Kind, label: "PDF", Icon: FileText },
                { value: "jpg" as Kind, label: "JPG", Icon: FileImage },
              ]
            ).map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                aria-pressed={kind === value}
                onClick={() => setKind(value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                  kind === value ? "bg-primary text-primary-foreground" : "text-ink-muted hover:text-primary",
                )}
              >
                <Icon aria-hidden className="size-4" />
                {label}
              </button>
            ))}
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={useAll}
              onChange={(e) => setUseAll(e.target.checked)}
              className="size-4 rounded border-control-border"
            />
            Semua hasil filter
          </label>

          <Button variant="secondary" onClick={() => void startIssue()} loading={busy === "issue"} disabled={busy !== null || useAllEffective || selected.length === 0}>
            <Printer aria-hidden /> Terbitkan nomor
          </Button>

          <Button onClick={() => void startExport()} loading={busy === "export"} disabled={busy !== null}>
            <Download aria-hidden /> Unduh ZIP
          </Button>

          {selected.length > 0 && (
            <Button variant="ghost" onClick={onClear} disabled={busy !== null}>
              <X aria-hidden /> Bersihkan pilihan
            </Button>
          )}
        </div>

        <p className="text-xs leading-relaxed text-ink-muted">
          {kind === "pdf"
            ? "Satu PDF per peserta: halaman 1 sisi depan, halaman 2 sisi belakang. Nama berkas [nomor]-[nama].pdf."
            : "Dua JPG per peserta: [nomor]-[nama]-depan.jpg dan [nomor]-[nama]-belakang.jpg."}{" "}
          Semua berkas dikemas dalam satu ZIP.
        </p>

        {job && (
          <div className="rounded-lg border border-border bg-bg/60 p-4">
            {job.status === "running" ? (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-ink">Menyiapkan kartu…</span>
                  <span className="tabular-nums text-ink-muted">
                    {job.done}/{job.total}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="mt-2 h-2 overflow-hidden rounded-full bg-border"
                >
                  <div className="h-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
                </div>
              </>
            ) : job.status === "done" ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-ink">
                  Siap diunduh: <span className="font-mono text-xs">{job.fileName}</span>
                </p>
                <a
                  href={`${exportBase}/${job.id}?download=1`}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground"
                >
                  <Download aria-hidden className="size-4" />
                  Unduh ZIP
                </a>
              </div>
            ) : (
              <p className="text-sm font-medium text-danger">{job.message ?? "Ekspor gagal."}</p>
            )}

            {job.skipped.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium text-ink">
                  {job.skipped.length} peserta dilewati
                </summary>
                <ul className="mt-2 space-y-1 text-xs text-ink-muted">
                  {job.skipped.slice(0, 30).map((s) => (
                    <li key={s.label}>
                      <span className="font-mono">{s.label}</span>, {s.reason}
                    </li>
                  ))}
                  {job.skipped.length > 30 && <li>…dan {job.skipped.length - 30} lainnya.</li>}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
