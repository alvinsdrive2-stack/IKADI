"use client";

import { useCallback, useEffect, useState } from "react";
import { SessionExpired } from "@/components/AdminNav";
import { Alert } from "@/components/Alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/components/constants";
import { displayMemberNumber } from "@/lib/member-number";

type Card = {
  id: string;
  memberNumber: string;
  levelLabel: string;
  issuedAt: string;
  isManual: boolean;
  isActive: boolean;
  retiredAt: string | null;
};

type State =
  | { kind: "loading" }
  | { kind: "ok"; cards: Card[] }
  | { kind: "unauthorized" }
  | { kind: "error" };

/**
 * Riwayat nomor anggota + penerbitan kartu baru.
 *
 * Satu peserta boleh punya banyak kartu; hanya satu yang aktif dan itulah yang
 * tampil di QR. Nomor baru bisa diterbitkan otomatis (sequence) atau diketik
 * manual oleh admin untuk nomor cantik / nomor lama yang dipulihkan.
 */
export function MemberCardsPanel({
  id,
  apiBase = "/api/admin/participants",
  detailPath,
}: {
  id: string;
  /** Endpoint keanggotaan; pengurus memakai /api/anggota/pengurus/anggota. */
  apiBase?: string;
  /** Halaman cetak KTA, untuk memuat ulang setelah nomor aktif berubah. */
  detailPath?: (participantId: string) => string;
}) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(() => {
    const ctrl = new AbortController();
    fetch(`${apiBase}/${encodeURIComponent(id)}/kartu`, {
      signal: ctrl.signal,
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(async (res) => {
        if (res.status === 401) return setState({ kind: "unauthorized" });
        if (!res.ok) return setState({ kind: "error" });
        const body = await res.json();
        setState({ kind: "ok", cards: (body?.data ?? []) as Card[] });
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setState({ kind: "error" });
      });
    return () => ctrl.abort();
  }, [id, apiBase]);

  useEffect(() => load(), [load, attempt]);

  const post = async (path: string, payload: Record<string, unknown>, successText: string) => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`${apiBase}/${encodeURIComponent(id)}/kartu${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => null);
      if (res.status === 401) {
        setState({ kind: "unauthorized" });
        return false;
      }
      if (!res.ok) {
        setNotice({ tone: "error", text: String(body?.message ?? "Gagal menyimpan. Coba lagi.") });
        return false;
      }
      setNotice({ tone: "success", text: successText });
      setAttempt((a) => a + 1);
      return true;
    } catch {
      setNotice({ tone: "error", text: "Koneksi bermasalah. Coba lagi." });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const issue = async (memberNumber?: string) => {
    const ok = await post(
      "",
      memberNumber ? { memberNumber } : {},
      memberNumber
        ? `Nomor ${displayMemberNumber(memberNumber)} diterbitkan dan langsung aktif.`
        : "Nomor baru diterbitkan otomatis dan langsung aktif.",
    );
    if (ok) setManual("");
  };

  if (state.kind === "loading") {
    return <div aria-busy="true" aria-label="Memuat riwayat nomor" className="h-32 animate-pulse rounded-xl border border-border bg-white" />;
  }
  if (state.kind === "unauthorized") return <SessionExpired />;
  if (state.kind === "error") {
    return (
      <Alert tone="error">
        Gagal memuat riwayat nomor.{" "}
        <button type="button" onClick={() => setAttempt((a) => a + 1)} className="ml-2 rounded-md border border-danger px-3 py-1.5 font-semibold">
          Coba lagi
        </button>
      </Alert>
    );
  }

  const cards = state.cards;
  const active = cards.find((c) => c.isActive) ?? null;

  return (
    <section className="rounded-xl border border-border bg-white" aria-labelledby="member-cards-h">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h2 id="member-cards-h" className="text-sm font-semibold text-ink">
            Nomor anggota
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Satu peserta boleh punya lebih dari satu kartu. Hanya nomor aktif yang tampil saat QR di-scan.
          </p>
        </div>
        {active ? <Badge variant="success">Aktif: {displayMemberNumber(active.memberNumber)}</Badge> : <Badge variant="pd">Belum ada nomor</Badge>}
      </div>

      <div className="space-y-5 p-5">
        {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

        {cards.length === 0 ? (
          <p className="text-sm text-ink-muted">Peserta ini belum pernah punya nomor anggota.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {cards.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-mono text-base font-semibold tabular-nums tracking-wide text-ink">
                    {displayMemberNumber(c.memberNumber)}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {c.levelLabel} · terbit {formatDate(c.issuedAt)}
                    {c.isManual && " · manual"}
                    {c.retiredAt && ` · diganti ${formatDate(c.retiredAt)}`}
                  </p>
                </div>
                {c.isActive ? (
                  <Badge variant="success">Aktif</Badge>
                ) : confirmId === c.id ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-ink-muted">Jadikan nomor aktif?</span>
                    <Button
                      size="sm"
                      loading={busy}
                      disabled={busy}
                      onClick={async () => {
                        const ok = await post(
                          "/aktifkan",
                          { cardId: c.id },
                          `Nomor ${displayMemberNumber(c.memberNumber)} sekarang aktif.`,
                        );
                        if (ok) setConfirmId(null);
                      }}
                    >
                      Ya, aktifkan
                    </Button>
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirmId(null)}>
                      Batal
                    </Button>
                  </span>
                ) : (
                  <Button variant="secondary" size="sm" disabled={busy} onClick={() => setConfirmId(c.id)}>
                    Aktifkan nomor ini
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-border pt-5">
          <h3 className="text-sm font-semibold text-ink">Terbitkan nomor baru</h3>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            Nomor baru langsung aktif dan nomor yang sekarang otomatis ditandai diganti. Yang lama tetap tersimpan di
            riwayat dan halaman verifikasinya mengarah ke nomor aktif.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button loading={busy} disabled={busy} onClick={() => void issue()}>
              Terbitkan otomatis
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1 space-y-1.5">
              <Label htmlFor="m-card-number" className="block text-sm font-medium text-ink">
                Atau ketik nomor manual
              </Label>
              <Input
                id="m-card-number"
                value={manual}
                placeholder="6.16.01.26.00100"
                disabled={busy}
                onChange={(e) => setManual(e.target.value.trim())}
              />
              <p className="text-xs text-ink-muted">Format L.WW.DD.YY.NNNN(N), harus belum dipakai kartu lain.</p>
            </div>
            <Button
              variant="secondary"
              loading={busy}
              disabled={busy || !manual}
              onClick={() => void issue(manual)}
            >
              Pakai nomor ini
            </Button>
          </div>
        </div>

        {active && detailPath && (
          <p className="text-sm text-ink-muted">
            Kartu dengan nomor aktif dicetak dari halaman{" "}
            <a href={detailPath(id)} className="font-medium text-primary underline-offset-2 hover:underline">
              Cetak KTA
            </a>
            .
          </p>
        )}
      </div>
    </section>
  );
}
