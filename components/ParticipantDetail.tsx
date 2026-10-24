"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { OriginBadge } from "@/components/Badge";
import { SessionExpired } from "@/components/AdminNav";
import { GENDER_LABELS, QURAN_LABELS, SERMON_LABELS, formatDate, formatDateTime } from "@/components/constants";

type Detail = {
  id: string;
  createdAt: string;
  originType: string;
  originName: string;
  fullName: string;
  nik: string;
  birthPlace: string;
  birthDate: string;
  gender: string;
  photoPath: string | null;
  address: string;
  whatsapp: string;
  lastEducation: string | null;
  occupation: string;
  expertise: string | null;
  sermonExperience: string;
  sermonExperienceOther: string | null;
  organizationExperience: string | null;
  quranReading: string;
  trainingReason: string;
  trainingExpectation: string;
};

type State =
  | { kind: "loading" }
  | { kind: "ok"; data: Detail }
  | { kind: "notfound" }
  | { kind: "unauthorized" }
  | { kind: "error" };

export function ParticipantDetail({ id }: { id: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/admin/participants/${encodeURIComponent(id)}`, {
      signal: ctrl.signal,
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(async (res) => {
        if (res.status === 401) setState({ kind: "unauthorized" });
        else if (res.status === 404) setState({ kind: "notfound" });
        else if (!res.ok) setState({ kind: "error" });
        else {
          const body = await res.json();
          setState({ kind: "ok", data: body.data ?? body });
        }
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setState({ kind: "error" });
      });
    return () => ctrl.abort();
  }, [id, attempt]);

  const back = (
    <Link
      href="/admin"
      className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-hover"
    >
      &larr; Kembali ke daftar
    </Link>
  );

  if (state.kind === "loading") {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Memuat detail peserta">
        {back}
        <div className="h-10 w-2/3 animate-pulse rounded-sm bg-border" />
        <div className="h-48 animate-pulse rounded-lg border border-border bg-surface" />
        <div className="h-64 animate-pulse rounded-lg border border-border bg-surface" />
      </div>
    );
  }

  if (state.kind === "unauthorized") return <SessionExpired />;

  if (state.kind === "notfound") {
    return (
      <div className="space-y-4">
        {back}
        <div
          role="alert"
          className="rounded-md border border-danger-border bg-danger-soft p-4 text-sm font-medium text-danger"
        >
          Data peserta tidak ditemukan.
        </div>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="space-y-4">
        {back}
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-md border border-danger-border bg-danger-soft p-4 text-sm font-medium text-danger"
        >
          Gagal memuat data.
          <button
            type="button"
            onClick={() => setAttempt((a) => a + 1)}
            className="rounded-md border border-danger px-3 py-1.5"
          >
            Coba lagi
          </button>
        </div>
      </div>
    );
  }

  const d = state.data;

  return (
    <div>
      {back}

      <div className="mb-4 flex items-start gap-2 rounded-md border border-accent/40 bg-accent-soft p-3 text-sm text-accent-ink">
        <svg
          aria-hidden
          className="mt-0.5 size-4 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75M6.75 21h10.5a2.25 2.25 0 0 0 2.25-2.25V12a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 12v6.75A2.25 2.25 0 0 0 6.75 21Z" />
        </svg>
        <p>NIK bersifat pribadi. Jangan bagikan tangkapan layar halaman ini.</p>
      </div>

      <div className="mb-1 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-ink">{d.fullName}</h1>
        <OriginBadge type={d.originType} />
      </div>
      <p className="mb-6 text-sm text-ink-muted">
        Dikirim pada {formatDateTime(d.createdAt)}
      </p>

      <Group title="Identitas">
        <Item label="Asal IKADI" span={1}>
          <span className="inline-flex items-center gap-2">
            <OriginBadge type={d.originType} /> {d.originName}
          </span>
        </Item>
        <Item label="Nama Lengkap & Gelar">{d.fullName}</Item>
        <Item label="Nomor NIK KTP" span={2} copyValue={d.nik} mono>
          {d.nik}
        </Item>
      </Group>

      <Group title="Data pribadi">
        <Item label="Jenis kelamin">
          {GENDER_LABELS[d.gender] ?? d.gender}
        </Item>
        <Item label="Tempat, tanggal lahir">
          {d.birthPlace}, {formatDate(d.birthDate)}
        </Item>
        <Item label="No. WhatsApp" copyValue={d.whatsapp} mono>
          <a
            href={`tel:${d.whatsapp.replace(/^\+?0?/, "+62")}`}
            className="text-primary underline underline-offset-2"
          >
            {d.whatsapp}
          </a>
        </Item>
        <Item label="Alamat" span={2}>
          {d.address}
        </Item>
      </Group>

      <Group title="Latar belakang & pengalaman">
        <Item label="Pendidikan terakhir">{d.lastEducation ?? "-"}</Item>
        <Item label="Pekerjaan">{d.occupation}</Item>
        <Item label="Bidang keahlian" span={2}>
          {d.expertise ?? "-"}
        </Item>
        <Item label="Pengalaman khutbah">
          {SERMON_LABELS[d.sermonExperience] ?? d.sermonExperience}
        </Item>
        <Item label="Kemampuan membaca Al-Qur'an">
          {QURAN_LABELS[d.quranReading] ?? d.quranReading}
        </Item>
        {d.sermonExperienceOther && (
          <Item label="Keterangan pengalaman khutbah" span={2}>
            {d.sermonExperienceOther}
          </Item>
        )}
        <Item label="Pengalaman organisasi - jabatan" span={2}>
          {d.organizationExperience ?? "-"}
        </Item>
      </Group>

      <Group title="Motivasi">
        <Item label="Alasan mengikuti pelatihan" span={2}>
          {d.trainingReason}
        </Item>
        <Item label="Harapan setelah pelatihan" span={2}>
          {d.trainingExpectation}
        </Item>
      </Group>

      <Group title="Pas Foto">
        {d.photoPath ? (
          // eslint-disable-next-line @next/next/no-img-element -- file di-upload user, <Image> butuh remotePatterns config
          <img
            src={`/${d.photoPath}`}
            alt={`Pas foto ${d.fullName}`}
            width={320}
            height={400}
            loading="lazy"
            className="max-w-40 rounded-lg border border-border"
          />
        ) : (
          <p className="text-sm text-ink-muted">Pas foto belum diunggah.</p>
        )}
      </Group>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 overflow-hidden rounded-lg border border-border bg-surface shadow-card">
      <h2 className="border-b border-border px-5 py-4 text-base font-semibold text-ink sm:px-6">
        {title}
      </h2>
      <dl className="grid gap-x-8 gap-y-5 p-5 sm:grid-cols-2 sm:p-6">{children}</dl>
    </section>
  );
}

function Item({
  label,
  children,
  span = 1,
  mono,
  copyValue,
}: {
  label: string;
  children: React.ReactNode;
  span?: 1 | 2;
  mono?: boolean;
  copyValue?: string;
}) {
  return (
    <div className={span === 2 ? "sm:col-span-2" : ""}>
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd
        className={`mt-0.5 flex flex-wrap items-center gap-2 text-base break-words ${
          mono ? "font-mono tabular-nums tracking-wide" : ""
        }`}
      >
        {children}
        {copyValue && <CopyButton value={copyValue} />}
      </dd>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            setCopied(false);
          }
        }}
        className="inline-flex min-h-11 items-center rounded-md border border-primary bg-surface px-3 text-sm font-semibold text-primary hover:bg-bg md:h-9 md:min-h-0"
      >
        Salin
      </button>
      <span aria-live="polite" className="text-sm text-primary">
        {copied ? "Disalin." : ""}
      </span>
    </>
  );
}
