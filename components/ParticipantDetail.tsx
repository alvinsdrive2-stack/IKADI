"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, Printer, ShieldCheck } from "lucide-react";
import { OriginBadge } from "@/components/Badge";
import { SessionExpired } from "@/components/AdminNav";
import { Alert } from "@/components/Alert";
import { MembershipAdmin } from "@/components/MembershipAdmin";
import { PageBanner } from "@/components/PageBanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BLOOD_LABELS,
  GENDER_LABELS,
  MARITAL_LABELS,
  QURAN_LABELS,
  SERMON_LABELS,
  formatDate,
  formatDateTime,
} from "@/components/constants";
import { cn } from "@/lib/utils";

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
  maritalStatus: string | null;
  bloodType: string | null;
  photoPath: string | null;
  ktpPath: string | null;
  address: string;
  addressKtp: string | null;
  addressCurrent: string | null;
  province: string | null;
  city: string | null;
  whatsapp: string;
  lastEducation: string | null;
  studyField: string | null;
  occupation: string;
  expertise: string | null;
  sermonExperience: string;
  sermonExperienceOther: string | null;
  organizationExperience: string | null;
  quranReading: string;
  trainingReason: string;
  trainingExpectation: string;
  memberNumber?: string | null;
};

type State = { kind: "loading" } | { kind: "ok"; data: Detail } | { kind: "notfound" } | { kind: "unauthorized" } | { kind: "error" };

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
      href="/admin/peserta"
      className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
    >
      <ArrowLeft aria-hidden className="size-4" /> Kembali ke peserta
    </Link>
  );

  if (state.kind === "loading") {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="Memuat detail peserta">
        {back}
        <div className="h-24 animate-pulse rounded-xl border border-border bg-white" />
        <div className="h-24 animate-pulse rounded-xl border border-border bg-white" />
        <div className="h-72 animate-pulse rounded-xl border border-border bg-white" />
      </div>
    );
  }

  if (state.kind === "unauthorized") return <SessionExpired />;

  if (state.kind === "notfound")
    return (
      <div className="space-y-5">
        {back}
        <Alert tone="error">Data peserta tidak ditemukan.</Alert>
      </div>
    );

  if (state.kind === "error") {
    return (
      <div className="space-y-5">
        {back}
        <Alert tone="error">
          Gagal memuat data.{" "}
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

  const d = state.data;
  const hasKta = !!d.memberNumber;

  return (
    <div className="space-y-5">
      <PageBanner
        headingId="page-h"
        title={d.fullName}
        description={`Dikirim ${formatDateTime(d.createdAt)}`}
        image="/ornaments/1.svg"
        back={{ href: "/admin/peserta", label: "Kembali ke peserta" }}
        badge={
          <>
            <OriginBadge type={d.originType} />
            <Badge variant={hasKta ? "success" : "pd"}>{hasKta ? "KTA terbit" : "Menunggu KTA"}</Badge>
          </>
        }
        action={
          <Button asChild>
            <Link href={`/admin/peserta/${id}/kta`}>
              <Printer aria-hidden /> Cetak KTA
            </Link>
          </Button>
        }
      />

      <MembershipAdmin id={id} />

      <div className="grid gap-4 lg:grid-cols-[1fr_240px] lg:items-start">
        <div className="rounded-xl border border-border bg-white px-5 sm:px-6">
          <Group title="Identitas">
            <Item label="Asal IKADI">
              <span className="inline-flex flex-wrap items-center gap-2">
                <OriginBadge type={d.originType} /> {d.originName}
              </span>
            </Item>
            <Item label="Nama lengkap & gelar">{d.fullName}</Item>
            <Item label="NIK KTP" span={2} copyValue={d.nik} mono>
              {d.nik}
            </Item>
            {hasKta && (
              <Item label="Nomor anggota" copyValue={d.memberNumber ?? undefined} mono>
                {d.memberNumber}
              </Item>
            )}
          </Group>

          <Group title="Data pribadi">
            <Item label="Jenis kelamin">{GENDER_LABELS[d.gender] ?? d.gender}</Item>
            <Item label="Status pernikahan">
              {d.maritalStatus ? MARITAL_LABELS[d.maritalStatus] ?? d.maritalStatus : "-"}
            </Item>
            <Item label="Golongan darah">{d.bloodType ? BLOOD_LABELS[d.bloodType] ?? d.bloodType : "-"}</Item>
            <Item label="Tempat, tanggal lahir">
              {d.birthPlace}, {formatDate(d.birthDate)}
            </Item>
            <Item label="No. WhatsApp" copyValue={d.whatsapp} mono>
              <a href={`tel:${d.whatsapp.replace(/^\+?0?/, "+62")}`} className="text-primary underline-offset-2 hover:underline">
                {d.whatsapp}
              </a>
            </Item>
            <Item label="Provinsi">{d.province ?? "-"}</Item>
            <Item label="Kabupaten/Kota">{d.city ?? "-"}</Item>
            <Item label="Alamat sesuai KTP" span={2}>
              {d.addressKtp ?? "-"}
            </Item>
            <Item label="Alamat tinggal saat ini" span={2}>
              {d.addressCurrent ?? "-"}
            </Item>
          </Group>

          <Group title="Latar belakang & pengalaman">
            <Item label="Pendidikan terakhir">{d.lastEducation ?? "-"}</Item>
            <Item label="Bidang studi">{d.studyField ?? "-"}</Item>
            <Item label="Pekerjaan">{d.occupation}</Item>
            <Item label="Bidang keahlian" span={2}>
              {d.expertise ?? "-"}
            </Item>
            <Item label="Pengalaman khutbah">{SERMON_LABELS[d.sermonExperience] ?? d.sermonExperience}</Item>
            <Item label="Kemampuan membaca Al-Qur'an">{QURAN_LABELS[d.quranReading] ?? d.quranReading}</Item>
            {d.sermonExperienceOther && (
              <Item label="Keterangan pengalaman khutbah" span={2}>
                {d.sermonExperienceOther}
              </Item>
            )}
            <Item label="Pengalaman organisasi — jabatan" span={2}>
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
        </div>

        <aside className="space-y-4">
          <section className="rounded-xl border border-accent/40 bg-accent-soft p-4">
            <h2 className="flex items-center gap-1.5 text-xs font-semibold text-accent-ink">
              <ShieldCheck aria-hidden className="size-4" /> Data pribadi
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-accent-ink">
              NIK bersifat pribadi. Jangan bagikan tangkapan layar halaman ini.
            </p>
          </section>

          <section className="rounded-xl border border-border bg-white">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-ink">Berkas</h2>
            </div>
            <div className="space-y-3 p-4">
              <div>
                <p className="text-xs text-ink-muted">Pas foto</p>
                {d.photoPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/${d.photoPath}`}
                    alt={`Pas foto ${d.fullName}`}
                    width={320}
                    height={400}
                    loading="lazy"
                    className="mt-1.5 w-full max-w-36 rounded-lg border border-border"
                  />
                ) : (
                  <p className="mt-1 text-sm text-ink-muted">Belum diunggah.</p>
                )}
              </div>
              <div>
                <p className="text-xs text-ink-muted">Foto KTP</p>
                {d.ktpPath ? (
                  <a
                    href={`/api/admin/participants/${encodeURIComponent(d.id)}/ktp`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex min-h-10 items-center text-sm font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Lihat foto KTP
                  </a>
                ) : (
                  <p className="mt-1 text-sm text-ink-muted">Belum diunggah.</p>
                )}
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-border py-5 last:border-0">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <dl className="mt-3 grid gap-x-10 gap-y-4 sm:grid-cols-2">{children}</dl>
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
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 flex flex-wrap items-center gap-2 break-words text-sm text-ink",
          mono && "font-mono tabular-nums tracking-wide",
        )}
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
        aria-label={copied ? "Tersalin" : "Salin nilai"}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary-soft"
      >
        {copied ? <Check aria-hidden className="size-3.5" /> : <Copy aria-hidden className="size-3.5" />}
        {copied ? "Disalin" : "Salin"}
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? "Disalin." : ""}
      </span>
    </>
  );
}
