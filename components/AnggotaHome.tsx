"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, CircleDashed, Clock, IdCard, Printer, ShieldCheck, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/Alert";
import { OriginBadge } from "@/components/Badge";
import { MEMBERSHIP_STATUS_LABELS, formatDate, formatPersonName } from "@/components/constants";
import { cn } from "@/lib/utils";

type Profile = {
  fullName: string;
  nik: string;
  originType: "PW" | "PD";
  originName: string;
  levelCode: number;
  levelLabel: string;
  membershipStatus: "AKTIF" | "NONAKTIF" | "PUNABAKTI";
  province: string | null;
  city: string | null;
  memberNumber: string | null;
  memberNumberIssuedAt: string | null;
  memberSince: string;
  photoPath?: string | null;
  kta?: { verifyUrl: string; qrPng: string } | null;
};

type State = { kind: "loading" } | { kind: "ok"; data: Profile } | { kind: "unauthorized" } | { kind: "error" };

const STEPS = [
  { label: "Terdaftar", desc: "Data tersimpan" },
  { label: "Verifikasi pengurus", desc: "Berkas diperiksa" },
  { label: "KTA terbit", desc: "Nomor dan QR aktif" },
];

export function AnggotaHome({ variant = "dashboard" }: { variant?: "dashboard" | "profil" | "status" }) {
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

  if (state.kind === "loading") {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Memuat profil">
        <div className="h-8 w-56 animate-pulse rounded bg-border/70" />
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="h-64 animate-pulse rounded-xl border border-border bg-white" />
          <div className="h-64 animate-pulse rounded-xl border border-border bg-white" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-52 animate-pulse rounded-xl border border-border bg-white" />
          <div className="h-52 animate-pulse rounded-xl border border-border bg-white" />
        </div>
      </div>
    );
  }

  if (state.kind === "unauthorized") return <p className="text-sm text-ink-muted">Mengalihkan ke halaman masuk…</p>;

  if (state.kind === "error") {
    return (
      <Alert tone="error">
        Gagal memuat profil.{" "}
        <button
          type="button"
          onClick={() => setAttempt((a) => a + 1)}
          className="ml-2 rounded-md border border-danger px-3 py-1.5 text-sm font-semibold"
        >
          Coba lagi
        </button>
      </Alert>
    );
  }

  const d = state.data;
  const hasKta = !!d.memberNumber;
  const displayName = formatPersonName(d.fullName);
  const firstName = displayName.split(" ")[0] ?? displayName;
  const statusLabel = MEMBERSHIP_STATUS_LABELS[d.membershipStatus] ?? d.membershipStatus;
  const wilayah = [d.province, d.city].filter(Boolean).join(" · ") || "—";

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Nama lengkap", value: displayName },
    {
      label: "Asal IKADI",
      value: (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <OriginBadge type={d.originType} />
          {d.originName}
        </span>
      ),
    },
    { label: "Jenjang", value: d.levelLabel },
    { label: "Provinsi", value: d.province ?? "—" },
    { label: "Kabupaten/Kota", value: d.city ?? "—" },
    { label: "Status keanggotaan", value: statusLabel },
    {
      label: "Nomor anggota",
      value: d.memberNumber ? (
        <span className="font-mono tabular-nums tracking-wide">{d.memberNumber}</span>
      ) : (
        <span className="text-ink-muted">Belum terbit</span>
      ),
    },
    { label: "Tanggal bergabung", value: formatDate(d.memberSince) },
  ];

  if (variant === "status") {
    return (
      <section className="rounded-xl border border-border bg-white" aria-labelledby="status-h">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id="status-h" className="text-sm font-semibold text-ink">
              Progres pengajuan
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">
              {hasKta
                ? "Seluruh tahap selesai. Kartu dapat dibuka dan dicetak."
                : "Pengajuan masuk. Menunggu verifikasi dan penerbitan oleh pengurus."}
            </p>
          </div>
          <Badge variant={hasKta ? "success" : "pd"}>{hasKta ? "Terbit" : "Menunggu"}</Badge>
        </div>

        <div className="space-y-5 p-5">
          <SubmissionSteps hasKta={hasKta} />

          <dl className="grid gap-4 border-t border-border pt-5 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-ink-muted">Terdaftar</dt>
              <dd className="mt-0.5 text-sm font-medium text-ink">{formatDate(d.memberSince)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Nomor anggota</dt>
              <dd className="mt-0.5 font-mono text-sm font-medium tabular-nums text-ink">{d.memberNumber ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Tanggal terbit</dt>
              <dd className="mt-0.5 text-sm font-medium text-ink">
                {d.memberNumberIssuedAt ? formatDate(d.memberNumberIssuedAt) : "—"}
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href="/anggota/kartu">
                <IdCard aria-hidden /> {hasKta ? "Lihat kartu" : "Pratinjau kartu"}
              </Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href="/anggota/profil">Lihat profil</Link>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  if (variant === "profil") {
    return (
      <section className="rounded-xl border border-border bg-white" aria-labelledby="profil-h">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id="profil-h" className="text-sm font-semibold text-ink">
              Data keanggotaan
            </h2>
            <p className="mt-1 text-sm text-ink-muted">Perubahan data dilakukan melalui pengurus wilayah.</p>
          </div>
          <Badge variant="secondary">{d.levelLabel}</Badge>
        </div>
        <dl className="grid gap-x-10 gap-y-5 p-5 sm:grid-cols-2">
          {rows.map((r) => (
            <div key={r.label}>
              <dt className="text-xs text-ink-muted">{r.label}</dt>
              <dd className="mt-1 break-words text-sm font-medium text-ink">{r.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Assalamualaikum, {firstName}</h1>
          <p className="mt-1.5 text-sm text-ink-muted">Ringkasan keanggotaan Anda di IKADI.</p>
        </div>
        <Badge variant={hasKta ? "success" : "pd"}>{statusLabel}</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <section
          aria-labelledby="kta-h"
          className="relative overflow-hidden rounded-xl border border-primary/15 bg-primary-soft"
        >
          <Image
            src="/ornaments/1.svg"
            alt=""
            fill
            unoptimized
            sizes="(max-width: 1024px) 100vw, 55vw"
            className="object-cover"
          />
          <div className="relative p-4 sm:p-5">
            <div className="rounded-lg border border-border bg-white p-5 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 id="kta-h" className="text-xs font-semibold text-ink-muted">
                    Kartu Tanda Anggota
                  </h2>
                  <p className="mt-2 break-all font-mono text-2xl font-bold tabular-nums tracking-wide text-ink sm:text-3xl">
                    {d.memberNumber ?? "Belum terbit"}
                  </p>
                </div>
                <Badge variant={hasKta ? "success" : "secondary"}>{hasKta ? "Terbit" : "Menunggu"}</Badge>
              </div>

              <dl className="mt-5 grid gap-x-6 gap-y-3 border-t border-border pt-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <dt className="text-xs text-ink-muted">Nama</dt>
                  <dd className="mt-0.5 truncate text-sm font-medium text-ink">{displayName}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-ink-muted">Asal IKADI</dt>
                  <dd className="mt-0.5 truncate text-sm font-medium text-ink">
                    {d.originType} · {d.originName}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-ink-muted">Jenjang</dt>
                  <dd className="mt-0.5 truncate text-sm font-medium text-ink">{d.levelLabel}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-ink-muted">Wilayah</dt>
                  <dd className="mt-0.5 truncate text-sm font-medium text-ink">{wilayah}</dd>
                </div>
              </dl>

              <div className="mt-5 flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link href="/anggota/kartu">
                    <IdCard aria-hidden /> {hasKta ? "Lihat kartu" : "Pratinjau kartu"}
                  </Link>
                </Button>
                <Button asChild size="sm" variant="secondary">
                  <Link href="/anggota/profil">Profil</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="prog-h" className="flex flex-col rounded-xl border border-border bg-white">
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <h2 id="prog-h" className="text-sm font-semibold text-ink">
                Status pengajuan
              </h2>
              <p className="mt-1 text-xs text-ink-muted">{hasKta ? "Selesai" : "Sedang diproses pengurus"}</p>
            </div>
            <p className="shrink-0 text-sm font-semibold tabular-nums text-ink">
              {hasKta ? "3" : "2"} <span className="font-normal text-ink-muted">/ 3</span>
            </p>
          </div>
          <div className="flex-1 px-5 py-4">
            <div
              className="h-1 overflow-hidden rounded-full bg-border"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={3}
              aria-valuenow={hasKta ? 3 : 2}
              aria-label="Tahap pengajuan selesai"
            >
              <div className="h-full rounded-full bg-primary" style={{ width: hasKta ? "100%" : "67%" }} />
            </div>
            <SubmissionSteps hasKta={hasKta} className="mt-4" />
          </div>
          <div className="border-t border-border px-5 py-2">
            <Link
              href="/anggota/status"
              className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary-hover"
            >
              Lihat riwayat pengajuan <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="info-h" className="rounded-xl border border-border bg-white">
          <div className="border-b border-border px-5 py-4">
            <h2 id="info-h" className="text-sm font-semibold text-ink">
              Informasi keanggotaan
            </h2>
          </div>
          <dl className="divide-y divide-border">
            <InfoRow
              label="Asal IKADI"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <OriginBadge type={d.originType} />
                  {d.originName}
                </span>
              }
            />
            <InfoRow label="Wilayah" value={wilayah} />
            <InfoRow label="Status" value={statusLabel} />
            <InfoRow label="Nomor anggota" value={d.memberNumber ?? "Belum terbit"} mono={!!d.memberNumber} />
          </dl>
          <div className="border-t border-border px-5 py-2">
            <Link
              href="/anggota/profil"
              className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary-hover"
            >
              Lihat profil lengkap <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </section>

        <section aria-labelledby="riwayat-h" className="rounded-xl border border-border bg-white">
          <div className="border-b border-border px-5 py-4">
            <h2 id="riwayat-h" className="text-sm font-semibold text-ink">
              Riwayat
            </h2>
          </div>
          <div className="divide-y divide-border">
            <ActivityRow
              icon={<UserRound aria-hidden className="size-4" />}
              title="Akun keanggotaan dibuat"
              date={formatDate(d.memberSince)}
              done
            />
            <ActivityRow
              icon={<ShieldCheck aria-hidden className="size-4" />}
              title="Verifikasi data oleh pengurus"
              date={hasKta ? "Selesai" : "Menunggu"}
              done={hasKta}
            />
            <ActivityRow
              icon={<Printer aria-hidden className="size-4" />}
              title="Nomor anggota diterbitkan"
              date={d.memberNumberIssuedAt ? formatDate(d.memberNumberIssuedAt) : "Belum terbit"}
              done={hasKta}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function SubmissionSteps({ hasKta, className = "" }: { hasKta: boolean; className?: string }) {
  const done = hasKta ? 3 : 2;
  return (
    <ol className={cn("border-t border-border", className)}>
      {STEPS.map((s, i) => {
        const complete = i < done;
        return (
          <li
            key={s.label}
            className={cn("flex items-start gap-3 py-3", i < STEPS.length - 1 && "border-b border-border")}
          >
            <span
              aria-hidden
              className={cn(
                "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full",
                complete ? "bg-primary text-white" : "border border-control-border bg-white text-ink-muted",
              )}
            >
              {complete ? <Check className="size-3" strokeWidth={3} /> : <CircleDashed className="size-3" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm", complete ? "font-medium text-ink" : "text-ink-muted")}>{s.label}</p>
              <p className="mt-0.5 text-xs text-ink-muted">{s.desc}</p>
            </div>
            <span className={cn("shrink-0 text-xs font-medium", complete ? "text-primary-ink" : "text-ink-muted")}>
              {complete ? "Selesai" : "Menunggu"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ActivityRow({ icon, title, date, done }: { icon: React.ReactNode; title: string; date: string; done?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <span className="shrink-0 text-ink-muted">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-ink">{title}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-muted">
          <Clock aria-hidden className="size-3" /> {date}
        </p>
      </div>
      <span className={cn("shrink-0 text-xs font-medium", done ? "text-primary-ink" : "text-ink-muted")}>
        {done ? "Selesai" : "Menunggu"}
      </span>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-2.5">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className={cn("text-right text-sm font-medium text-ink", mono && "font-mono tabular-nums")}>{value}</dd>
    </div>
  );
}
