"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { Alert } from "@/components/Alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KtaStepper } from "@/components/ui/stepper";
import { KtaCardView } from "@/components/KtaCardView";
import { formatDate } from "@/components/constants";

type Kta = {
  verifyUrl: string;
  qrPng: string;
  pejabat?: { ketuaUmum: { nama: string; jabatan: string }; sekjen: { nama: string; jabatan: string } };
};
type Profile = {
  fullName: string;
  originType: "PW" | "PD";
  originName: string;
  levelLabel: string;
  province: string | null;
  city: string | null;
  memberNumber: string | null;
  memberNumberIssuedAt: string | null;
  memberSince: string;
  photoPath: string | null;
  kta: Kta | null;
};
type State = { kind: "loading" } | { kind: "ok"; data: Profile } | { kind: "unauthorized" } | { kind: "error" };

const FALLBACK_PEJABAT = {
  ketuaUmum: { nama: "Ketua Umum IKADI", jabatan: "Ketua Umum" },
  sekjen: { nama: "Sekretaris Jenderal", jabatan: "Sekretaris Jenderal" },
};

const STEPS = [
  { label: "Terdaftar", desc: "Data tersimpan" },
  { label: "Verifikasi admin", desc: "Diperiksa pengurus" },
  { label: "KTA terbit", desc: "Nomor + QR aktif" },
];

export function AnggotaKartu() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/anggota/me", { signal: ctrl.signal, cache: "no-store", credentials: "same-origin" })
      .then(async (res) => {
        if (res.status === 401) setState({ kind: "unauthorized" });
        else if (!res.ok) setState({ kind: "error" });
        else {
          const body = await res.json();
          setState({ kind: "ok", data: body.data });
        }
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setState({ kind: "error" });
      });
    return () => ctrl.abort();
  }, [attempt]);

  useEffect(() => {
    if (state.kind === "unauthorized") router.replace("/masuk");
  }, [state, router]);

  const back = (
    <Link
      href="/anggota"
      className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
    >
      <ArrowLeft aria-hidden className="size-4" /> Kembali ke dashboard
    </Link>
  );

  if (state.kind === "loading") {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="Memuat kartu">
        {back}
        <div className="h-8 w-56 animate-pulse rounded bg-border/70" />
        <div className="h-[53.98mm] w-[85.6mm] animate-pulse rounded border border-border bg-white" />
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="space-y-5">
        {back}
        <Alert tone="error">
          Gagal memuat kartu.{" "}
          <button
            type="button"
            onClick={() => setAttempt((a) => a + 1)}
            className="ml-2 rounded-md border border-danger px-3 py-1.5 text-sm font-semibold"
          >
            Coba lagi
          </button>
        </Alert>
      </div>
    );
  }

  if (state.kind !== "ok") return null;

  const p = state.data;
  const hasKta = !!p.kta;

  const placeholder = {
    memberNumber: "—",
    fullName: p.fullName,
    originType: p.originType,
    originName: p.originName,
    levelLabel: p.levelLabel,
    provinceName: p.province,
    regencyName: p.city,
    photoPath: p.photoPath,
    issuedAt: p.memberSince,
    verifyUrl: "",
    qrPng: "",
    pejabat: FALLBACK_PEJABAT,
  };

  if (!hasKta) {
    return (
      <div className="space-y-5">
        {back}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Kartu Tanda Anggota</h1>
          <p className="mt-1.5 text-sm text-ink-muted">Contoh tampilan kartu Anda sebelum nomor terbit.</p>
        </div>

        <section className="rounded-xl border border-border bg-white">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-ink">Tahap penerbitan</h2>
              <p className="mt-1 text-sm text-ink-muted">Nomor terbit saat pengurus mencetak kartu.</p>
            </div>
            <Badge variant="pd">Menunggu</Badge>
          </div>
          <div className="space-y-5 p-5">
            <div className="max-w-2xl">
              <KtaStepper steps={STEPS} current={1} />
            </div>
            <Alert tone="info">
              <span className="font-semibold">Nomor anggota belum terbit.</span> Nomor akan terbit saat kartu dicetak
              admin. Setelah itu kartu di sini otomatis memuat nomor dan QR verifikasi.
            </Alert>
          </div>
        </section>

        <div className="kta-print-reset rounded-xl border border-border bg-bg p-4 sm:p-6">
          <KtaCardView data={placeholder} />
        </div>
      </div>
    );
  }

  const data = {
    memberNumber: p.memberNumber ?? "—",
    fullName: p.fullName,
    originType: p.originType,
    originName: p.originName,
    levelLabel: p.levelLabel,
    provinceName: p.province,
    regencyName: p.city,
    photoPath: p.photoPath,
    issuedAt: p.memberNumberIssuedAt ?? p.memberSince,
    verifyUrl: p.kta!.verifyUrl,
    qrPng: p.kta!.qrPng,
    pejabat: p.kta!.pejabat ?? FALLBACK_PEJABAT,
  };

  return (
    <div className="space-y-5">
      <div className="kta-screen-only space-y-4">
        {back}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Kartu Tanda Anggota</h1>
            <p className="mt-1.5 text-sm text-ink-muted">
              Terbit {formatDate(p.memberNumberIssuedAt ?? p.memberSince)}. Bawa kartu ini saat kegiatan, atau cetak
              sendiri.
            </p>
          </div>
          <Button onClick={() => window.print()}>
            <Printer aria-hidden /> Cetak kartu
          </Button>
        </div>

        <section className="rounded-xl border border-border bg-white px-5 py-5">
          <div className="max-w-2xl">
            <KtaStepper steps={STEPS} current={2} />
          </div>
        </section>
      </div>

      <div className="kta-print-reset rounded-xl border border-border bg-bg p-4 sm:p-6">
        <KtaCardView data={data} />
      </div>

      <section className="kta-screen-only rounded-xl border border-border bg-white">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-ink">Tautan verifikasi</h2>
        </div>
        <div className="space-y-2 p-5 text-sm">
          <p className="break-all font-mono text-xs text-ink-muted">{data.verifyUrl}</p>
          <p className="text-ink-muted">
            QR di kartu membuka halaman verifikasi resmi berisi nama, nomor anggota, dan status keanggotaan.
          </p>
        </div>
      </section>
    </div>
  );
}
