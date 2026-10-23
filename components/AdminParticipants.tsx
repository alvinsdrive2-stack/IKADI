"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { OriginBadge } from "@/components/Badge";
import { Pagination } from "@/components/Pagination";
import { SessionExpired } from "@/components/AdminNav";
import { StatCard } from "@/components/StatCard";
import {
  EDUCATION_OPTIONS,
  SERMON_LABELS,
  formatDateTime,
} from "@/components/constants";

export type ParticipantRow = {
  id: string | number;
  createdAt: string;
  fullName: string;
  nikMasked: string;
  originType: string;
  originName: string;
  whatsappMasked: string;
  lastEducation: string | null;
};

type ListResponse = {
  ok: boolean;
  data: ParticipantRow[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};

type Stats = { total: number; pw: number; pd: number; today: number };

const FILTER_KEYS = [
  "q",
  "originType",
  "originName",
  "education",
  "sermon",
  "dateFrom",
  "dateTo",
] as const;

export function AdminParticipants() {
  const searchParams = useSearchParams();
  return <AdminData qs={searchParams.toString()} />;
}

function AdminData({ qs }: { qs: string }) {
  const router = useRouter();
  const params = new URLSearchParams(qs);
  const [result, setResult] = useState<{
    qs: string;
    list: ListResponse | null;
    stats: Stats | null;
    error: string | null;
    unauthorized: boolean;
  }>({ qs: "", list: null, stats: null, error: null, unauthorized: false });

  useEffect(() => {
    const ctrl = new AbortController();

    Promise.all([
      fetch(`/api/admin/participants?${qs}`, {
        signal: ctrl.signal,
        cache: "no-store",
        credentials: "same-origin",
      }),
      fetch("/api/admin/stats", {
        signal: ctrl.signal,
        cache: "no-store",
        credentials: "same-origin",
      }),
    ])
      .then(async ([listRes, statsRes]) => {
        if (listRes.status === 401 || statsRes.status === 401) {
          return { qs, list: null, stats: null, error: null, unauthorized: true };
        }
        if (!listRes.ok || !statsRes.ok) {
          throw new Error("Gagal memuat data.");
        }
        return {
          qs,
          list: (await listRes.json()) as ListResponse,
          stats: (await statsRes.json()) as Stats,
          error: null,
          unauthorized: false,
        };
      })
      .then(setResult)
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setResult({
          qs,
          list: null,
          stats: null,
          error: "Gagal memuat data.",
          unauthorized: false,
        });
      });

    return () => ctrl.abort();
  }, [qs]);

  // Hasil lama tidak dipakai untuk query baru -> skeleton saat filter berganti.
  const fresh = result.qs === qs;
  const list = fresh ? result.list : null;
  const stats = fresh ? result.stats : null;
  const error = fresh ? result.error : null;
  const unauthorized = fresh && result.unauthorized;
  const loading = !fresh;
  const retry = () => setResult((prev) => ({ ...prev, qs: "" }));

  const hasFilter = FILTER_KEYS.some((k) => params.get(k));
  const resetAll = () => router.push("/admin");

  if (unauthorized) {
    return <SessionExpired />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Dashboard Peserta</h1>
        <p className="text-sm text-ink-muted">
          Data pendataan KTA IKADI, diperbarui baru saja.
        </p>
      </div>

      <section aria-labelledby="stats-h">
        <h2 id="stats-h" className="sr-only">
          Ringkasan data
        </h2>
        <ul role="list" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <li>
            <StatCard label="Total peserta" value={stats?.total ?? 0} />
          </li>
          <li>
            <StatCard label="Jumlah PW" value={stats?.pw ?? 0} />
          </li>
          <li>
            <StatCard label="Jumlah PD" value={stats?.pd ?? 0} />
          </li>
          <li>
            <StatCard label="Peserta masuk hari ini" value={stats?.today ?? 0} />
          </li>
        </ul>
      </section>

      <FiltersPanel
        params={params}
        onApply={(next) => router.push(`/admin${next ? `?${next}` : ""}`)}
      />

      {hasFilter && (
        <ActiveChips
          params={params}
          onReset={resetAll}
          onChange={(key, value) => {
            const next = new URLSearchParams(qs);
            if (value) next.set(key, value);
            else next.delete(key);
            next.delete("page");
            router.push(`/admin${next.size ? `?${next}` : ""}`);
          }}
        />
      )}

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-md border border-danger-border bg-danger-soft p-4 text-sm font-medium text-danger"
        >
          {error}
          <button
            type="button"
            onClick={retry}
            className="rounded-md border border-danger px-3 py-1.5"
          >
            Coba lagi
          </button>
        </div>
      )}

      <section aria-labelledby="tbl-h" className="space-y-4">
        <h2 id="tbl-h" className="sr-only">
          Daftar peserta
        </h2>
        <div
          role="region"
          aria-label="Tabel data peserta"
          aria-busy={loading || undefined}
          tabIndex={0}
          className="overflow-x-auto rounded-lg border border-border bg-surface bg-[linear-gradient(to_left,transparent_80%,rgba(0,0,0,0.04))] bg-[length:24px_100%] bg-[position:right_top] bg-no-repeat"
        >
          <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
            <caption className="sr-only">
              Daftar peserta pendataan KTA IKADI
            </caption>
            <thead className="bg-bg">
              <tr>
                <th scope="col" className={th}>No.</th>
                <th scope="col" aria-sort={ariaSort(params.get("sort"), "date")} className={th}>
                  <SortButton
                    label="Tanggal Input"
                    current={params.get("sort") ?? "newest"}
                    asc="oldest"
                    desc="newest"
                    qs={qs}
                  />
                </th>
                <th scope="col" aria-sort={ariaSort(params.get("sort"), "name")} className={th}>
                  <SortButton
                    label="Nama Lengkap"
                    current={params.get("sort") ?? "newest"}
                    asc="name_asc"
                    desc="name_desc"
                    qs={qs}
                  />
                </th>
                <th scope="col" className={th}>NIK</th>
                <th scope="col" className={th}>Asal IKADI</th>
                <th scope="col" className={th}>Nama PW/PD</th>
                <th scope="col" className={th}>No. WA</th>
                <th scope="col" className={th}>Pendidikan</th>
                <th scope="col" className={th}>
                  <span className="sr-only">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && <SkeletonRows />}
              {!loading &&
                list?.data.map((p, i) => (
                  <tr key={p.id} className="border-t border-border hover:bg-bg/60">
                    <td className="px-4 py-3 tabular-nums text-ink-muted">
                      {(list.page - 1) * list.perPage + i + 1}
                    </td>
                    <td className={`px-4 py-3 ${mono}`}>{formatDateTime(p.createdAt)}</td>
                    <td className="px-4 py-3 font-medium">{p.fullName}</td>
                    <td className={`px-4 py-3 ${mono}`}>{p.nikMasked}</td>
                    <td className="px-4 py-3">
                      <OriginBadge type={p.originType} />
                    </td>
                    <td className="px-4 py-3">{p.originName}</td>
                    <td className={`px-4 py-3 ${mono}`}>{p.whatsappMasked}</td>
                    <td className="px-4 py-3">{p.lastEducation ?? "-"}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/peserta/${p.id}`}
                        className="inline-flex min-h-11 items-center rounded-md border border-primary bg-surface px-3 text-sm font-semibold text-primary hover:bg-bg md:h-9 md:min-h-0"
                      >
                        Detail
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>

          {!loading && list && list.data.length === 0 && (
            <EmptyState
              title="Tidak ada data yang cocok."
              description="Coba ubah kata kunci atau filter yang dipakai."
              action={
                hasFilter ? (
                  <button
                    type="button"
                    onClick={resetAll}
                    className="inline-flex min-h-11 items-center rounded-md border border-primary bg-surface px-5 text-base font-semibold text-primary hover:bg-bg"
                  >
                    Reset filter
                  </button>
                ) : undefined
              }
            />
          )}
        </div>

        {!loading && list && list.data.length > 0 && (
          <Pagination
            page={list.page}
            totalPages={list.totalPages}
            total={list.total}
            perPage={list.perPage}
            onPrev={() => setPage(router, qs, list.page - 1)}
            onNext={() => setPage(router, qs, list.page + 1)}
          />
        )}
      </section>
    </div>
  );
}

const th =
  "whitespace-nowrap px-4 py-3 text-sm font-semibold text-ink-muted";
const mono = "whitespace-nowrap font-mono text-sm tabular-nums tracking-wide";

function setPage(router: ReturnType<typeof useRouter>, qs: string, page: number) {
  const next = new URLSearchParams(qs);
  if (page > 1) next.set("page", String(page));
  else next.delete("page");
  router.push(`/admin${next.size ? `?${next}` : ""}`);
}

function ariaSort(
  current: string | null,
  col: "date" | "name",
): "ascending" | "descending" | "none" {
  if (col === "date") {
    if (current === "oldest") return "ascending";
    if (!current || current === "newest") return "descending";
  } else {
    if (current === "name_asc") return "ascending";
    if (current === "name_desc") return "descending";
  }
  return "none";
}

function SortButton({
  label,
  current,
  asc,
  desc,
  qs,
}: {
  label: string;
  current: string;
  asc: string;
  desc: string;
  qs: string;
}) {
  const isAsc = current === asc;
  const next = isAsc ? desc : asc;
  const params = new URLSearchParams(qs);
  params.set("sort", next);
  params.delete("page");
  return (
    <Link
      href={`/admin?${params}`}
      className="inline-flex min-h-11 items-center gap-1 font-semibold hover:text-primary md:min-h-0"
    >
      {label}
      <svg
        aria-hidden
        className={`size-3 shrink-0 transition-transform ${current === desc && isAsc ? "rotate-180" : ""} ${current === asc || current === desc ? "opacity-100" : "opacity-0"}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m6 15 6-6 6 6" />
      </svg>
    </Link>
  );
}

function FiltersPanel({
  params,
  onApply,
}: {
  params: URLSearchParams;
  onApply: (nextQs: string) => void;
}) {
  const initial = {
    q: params.get("q") ?? "",
    originType: params.get("originType") ?? "",
    originName: params.get("originName") ?? "",
    education: params.get("education") ?? "",
    sermon: params.get("sermon") ?? "",
    dateFrom: params.get("dateFrom") ?? "",
    dateTo: params.get("dateTo") ?? "",
  };
  const [values, setValues] = useState(initial);

  const set = (k: keyof typeof values) => (v: string) =>
    setValues((prev) => ({ ...prev, [k]: v }));

  const activeCount = (Object.keys(initial) as (keyof typeof initial)[]).filter(
    (k) => initial[k],
  ).length;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(values)) if (v.trim()) next.set(k, v.trim());
    const sort = params.get("sort");
    if (sort) next.set("sort", sort);
    const perPage = params.get("perPage");
    if (perPage) next.set("perPage", perPage);
    onApply(next.toString());
  };

  const reset = () => {
    setValues({
      q: "",
      originType: "",
      originName: "",
      education: "",
      sermon: "",
      dateFrom: "",
      dateTo: "",
    });
    const next = new URLSearchParams();
    const sort = params.get("sort");
    if (sort) next.set("sort", sort);
    onApply(next.toString());
  };

  const control =
    "h-11 w-full rounded-md border border-control-border bg-surface px-3 text-base text-ink hover:border-ink-muted focus:border-primary focus:outline-none";
  const label = "block text-sm font-medium text-ink";

  return (
    <section
      aria-labelledby="filter-h"
      className="rounded-lg border border-border bg-surface shadow-card"
    >
      <form onSubmit={submit}>
      <div className="flex items-center justify-between px-5 py-4">
        <h2 id="filter-h" className="text-base font-semibold text-ink">
          Cari &amp; filter
        </h2>
      </div>
      <div className="space-y-4 border-t border-border px-5 py-4">
        <div className="space-y-1.5">
          <label htmlFor="filter-q" className={label}>
            Cari peserta
          </label>
          <div className="relative">
            <svg
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              id="filter-q"
              type="search"
              value={values.q}
              onChange={(e) => set("q")(e.target.value)}
              placeholder="Nama, NIK, atau No. WA"
              className={`${control} pl-9`}
            />
          </div>
        </div>

        <details className="lg:hidden" open={activeCount > 1 || undefined}>
          <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-md border border-primary bg-surface px-3 text-sm font-semibold text-primary marker:content-none">
            Filter ({activeCount})
          </summary>
          <div className="mt-3 grid gap-4">
            <FilterFields values={values} set={set} />
          </div>
        </details>

        <div className="hidden gap-4 lg:grid lg:grid-cols-4">
          <FilterFields values={values} set={set} />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-11 w-full items-center justify-center rounded-md border border-primary bg-surface px-5 text-base font-semibold text-primary hover:bg-bg sm:w-auto"
          >
            Reset
          </button>
          <button
            type="submit"
            className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-5 text-base font-semibold text-white hover:bg-primary-hover sm:w-auto"
          >
            Terapkan
          </button>
        </div>
      </div>
      </form>
    </section>
  );
}

type FilterValues = {
  q: string;
  originType: string;
  originName: string;
  education: string;
  sermon: string;
  dateFrom: string;
  dateTo: string;
};

function FilterFields({
  values,
  set,
}: {
  values: FilterValues;
  set: (k: keyof FilterValues) => (v: string) => void;
}) {
  const control =
    "h-11 w-full rounded-md border border-control-border bg-surface px-3 text-base text-ink hover:border-ink-muted focus:border-primary focus:outline-none";
  const label = "block text-sm font-medium text-ink";
  return (
    <>
      <div className="space-y-1.5">
        <label htmlFor="f-origin" className={label}>
          Asal IKADI
        </label>
        <select
          id="f-origin"
          value={values.originType}
          onChange={(e) => set("originType")(e.target.value)}
          className={control}
        >
          <option value="">Semua</option>
          <option value="PW">PW</option>
          <option value="PD">PD</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="f-origin-name" className={label}>
          Nama PW/PD IKADI
        </label>
        <input
          id="f-origin-name"
          type="text"
          value={values.originName}
          onChange={(e) => set("originName")(e.target.value)}
          placeholder="Contoh: PW Jawa Timur"
          className={control}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="f-education" className={label}>
          Pendidikan Terakhir
        </label>
        <select
          id="f-education"
          value={values.education}
          onChange={(e) => set("education")(e.target.value)}
          className={control}
        >
          <option value="">Semua</option>
          {EDUCATION_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="f-sermon" className={label}>
          Pengalaman Khutbah
        </label>
        <select
          id="f-sermon"
          value={values.sermon}
          onChange={(e) => set("sermon")(e.target.value)}
          className={control}
        >
          <option value="">Semua</option>
          {Object.entries(SERMON_LABELS).map(([v, text]) => (
            <option key={v} value={v}>
              {text}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="f-from" className={label}>
          Tanggal input (dari)
        </label>
        <input
          id="f-from"
          type="date"
          value={values.dateFrom}
          onChange={(e) => set("dateFrom")(e.target.value)}
          className={control}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="f-to" className={label}>
          Tanggal input (sampai)
        </label>
        <input
          id="f-to"
          type="date"
          value={values.dateTo}
          onChange={(e) => set("dateTo")(e.target.value)}
          className={control}
        />
      </div>
    </>
  );
}

const CHIP_LABELS: Record<string, (v: string) => string> = {
  q: (v) => `Cari: ${v}`,
  originType: (v) => `Asal: ${v}`,
  originName: (v) => `PW/PD: ${v}`,
  education: (v) => `Pendidikan: ${v}`,
  sermon: (v) => `Khutbah: ${SERMON_LABELS[v] ?? v}`,
  dateFrom: (v) => `Dari: ${v}`,
  dateTo: (v) => `Sampai: ${v}`,
};

function ActiveChips({
  params,
  onReset,
  onChange,
}: {
  params: URLSearchParams;
  onReset: () => void;
  onChange: (key: string, value: string) => void;
}) {
  const chips = FILTER_KEYS.flatMap((k) => {
    const v = params.get(k);
    return v ? [{ key: k, value: v }] : [];
  });
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-ink-muted">Filter aktif:</span>
      {chips.map(({ key, value }) => (
        <span
          key={key}
          className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary-ink"
        >
          {CHIP_LABELS[key]?.(value) ?? `${key}: ${value}`}
          <button
            type="button"
            onClick={() => onChange(key, "")}
            aria-label={`Hapus filter ${CHIP_LABELS[key]?.(value) ?? key}`}
            className="-mr-1 inline-flex size-6 items-center justify-center rounded-full hover:bg-primary/10"
          >
            <span aria-hidden>&times;</span>
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onReset}
        className="text-sm font-medium text-primary underline underline-offset-2 hover:text-primary-hover"
      >
        Hapus semua
      </button>
    </div>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-t border-border" aria-hidden>
          {Array.from({ length: 9 }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 animate-pulse rounded-sm bg-border" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function AdminSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Memuat data">
      <div className="h-14" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg border border-border bg-surface" />
        ))}
      </div>
      <div className="h-56 animate-pulse rounded-lg border border-border bg-surface" />
      <div className="h-64 animate-pulse rounded-lg border border-border bg-surface" />
    </div>
  );
}
