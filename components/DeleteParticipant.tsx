"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { Alert } from "@/components/Alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Hapus peserta permanen.
 *
 * Penghapusan tidak bisa dibatalkan dan membawa kartu, riwayat, serta berkas
 * foto, jadi tombolnya baru aktif setelah admin mengetik nama peserta. Ini
 * menahan klik tak sengaja, bukan sekadar dialog "Yakin?" yang biasa
 * dikonfirmasi tanpa membaca.
 */
export function DeleteParticipant({
  participantId,
  fullName,
  apiBase,
  basePath,
}: {
  participantId: string;
  fullName: string;
  apiBase: string;
  basePath: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = typed.trim().toLocaleUpperCase("id-ID") === fullName.trim().toLocaleUpperCase("id-ID");

  const remove = async () => {
    if (!matches || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/${encodeURIComponent(participantId)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(String(body?.message ?? "Gagal menghapus. Coba lagi."));
        return;
      }
      router.replace(basePath);
      router.refresh();
    } catch {
      setError("Koneksi bermasalah. Coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <section className="rounded-xl border border-danger-border bg-danger-soft/40">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-danger">Hapus peserta</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
              Menghapus data peserta ini secara permanen beserta kartu dan foto.
            </p>
          </div>
          <Button type="button" variant="destructive" size="sm" onClick={() => setOpen(true)}>
            <Trash2 aria-hidden /> Hapus
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-danger-border bg-white">
      <div className="border-b border-danger-border bg-danger-soft/50 px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-danger">
          <AlertTriangle aria-hidden className="size-4" /> Hapus permanen
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
          Data peserta, kartu anggota, riwayat keanggotaan, riwayat cetak, pas foto, dan foto KTP
          akan hilang. Tindakan ini tidak bisa dibatalkan.
        </p>
      </div>

      <div className="space-y-4 p-5">
        {error && <Alert tone="error">{error}</Alert>}

        <div className="space-y-1.5">
          <Label htmlFor="delete-confirm" className="block text-sm font-medium text-ink">
            Ketik <span className="font-semibold text-danger">{fullName}</span> untuk mengonfirmasi
          </Label>
          <Input
            id="delete-confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            aria-describedby="delete-confirm-hint"
          />
          <p id="delete-confirm-hint" className="text-xs text-ink-muted">
            Nama harus sama persis.
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setOpen(false);
              setTyped("");
              setError(null);
            }}
            disabled={busy}
          >
            <X aria-hidden /> Batal
          </Button>
          <Button type="button" variant="destructive" onClick={remove} disabled={!matches} loading={busy}>
            <Trash2 aria-hidden /> {busy ? "Menghapus…" : "Hapus permanen"}
          </Button>
        </div>
      </div>
    </section>
  );
}
