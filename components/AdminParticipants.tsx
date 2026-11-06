"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ArrowUpDown, Search } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { OriginBadge } from "@/components/Badge";
import { PageBanner } from "@/components/PageBanner";
import { Pagination } from "@/components/Pagination";
import { SessionExpired } from "@/components/AdminNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchSelect } from "@/components/ui/search-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EDUCATION_OPTIONS, SERMON_LABELS, formatDateTime } from "@/components/constants";
import { cn } from "@/lib/utils";

export type ParticipantRow = {
  id: string | number;
  createdAt: string;
  fullName: string;
  nikMasked: string;
  originType: string;
  originName: string;
  whatsappMasked: string;
  lastEducation: string | null;
  memberNumber: string | null;
  levelCode: number;
  levelLabel: string;
};

type ListResponse = { ok: boolean; data: ParticipantRow[]; total: number; page: number; perPage: number; totalPages: number };
type Stats = { total: number; pw: number; pd: number; today: number; kta?: { printed: number; limit: number; remaining: number } };

const FILTER_KEYS = ["q", "originType", "originName", "education", "sermon", "dateFrom", "dateTo"] as const;

export function AdminParticipants({ mode = "list" }: { mode?: "dashboard" | "list" }) {
  const searchParams = useSearchParams();
  return <AdminData qs={searchParams.toString()} mode={mode} />;
}

function AdminData({ qs, mode }: { qs: string; mode: "dashboard" | "list" }) {
  const router = useRouter();
  const params = new URLSearchParams(qs);
  const query = mode === "dashboard" ? "perPage=10&sort=newest" : qs;
  const [result, setResult] = useState<{ qs: string; list: ListResponse | null; stats: Stats | null; error: string | null; unauthorized: boolean }>({
    qs: "", list: null, stats: null, error: null, unauthorized: false,
  });

  useEffect(() => {
    const ctrl = new AbortController();
    Promise.all([
      fetch(`/api/admin/participants?${query}`, { signal: ctrl.signal, cache: "no-store", credentials: "same-origin" }),
      fetch("/api/admin/stats", { signal: ctrl.signal, cache: "no-store", credentials: "same-origin" }),
    ])
      .then(async ([listRes, statsRes]) => {
        if (listRes.status === 401 || statsRes.status === 401) return { qs: query, list: null, stats: null, error: null, unauthorized: true };
        if (!listRes.ok || !statsRes.ok) throw new Error("Gagal memuat data.");
        return { qs: query, list: (await listRes.json()) as ListResponse, stats: (await statsRes.json()) as Stats, error: null, unauthorized: false };
      })
      .then(setResult)
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setResult({ qs: query, list: null, stats: null, error: "Gagal memuat data.", unauthorized: false });
      });
    return () => ctrl.abort();
  }, [query]);

  const fresh = result.qs === query;
  const list = fresh ? result.list : null;
  const stats = fresh ? result.stats : null;
  const error = fresh ? result.error : null;
  const unauthorized = fresh && result.unauthorized;
  const loading = !fresh;
  const retry = () => setResult((prev) => ({ ...prev, qs: "" }));
  const hasFilter = FILTER_KEYS.some((k) => params.get(k));
  const resetAll = () => router.push("/admin/peserta");
  const isDashboard = mode === "dashboard";

  if (unauthorized) return <SessionExpired />;

  return (
    <div className="space-y-6">
      {isDashboard ? (
        <PageBanner
          headingId="page-h"
          title="Ringkasan peserta"
          description="Data masuk terbaru dan peserta yang menunggu penerbitan kartu."
          image="/ornaments/2.svg"
          action={
            <Button asChild>
              <Link href="/admin/peserta">
                Kelola peserta
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          }
        />
      ) : (
        <PageBanner
          headingId="page-h"
          title="Peserta"
          description="Cari, periksa, dan terbitkan nomor anggota."
          image="/ornaments/1.svg"
        />
      )}

      <section aria-labelledby="stats-h" className="rounded-xl border border-border bg-white">
        <h2 id="stats-h" className="sr-only">Ringkasan data</h2>
        <dl className="grid grid-cols-2 divide-border sm:grid-cols-4 sm:divide-x">
          {[
            { label: "Total peserta", value: stats?.total },
            { label: "Masuk hari ini", value: stats?.today },
            { label: "PW", value: stats?.pw },
            { label: "PD", value: stats?.pd },
          ].map((s) => (
            <div key={s.label} className="border-b border-border px-5 py-4 sm:border-b-0">
              <dt className="text-xs text-ink-muted">{s.label}</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-ink">
                {loading || s.value === undefined ? "—" : s.value.toLocaleString("id-ID")}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {!isDashboard && (
        <FiltersPanel params={params} onApply={(next) => router.push(`/admin/peserta${next ? `?${next}` : ""}`)} />
      )}

      {!isDashboard && hasFilter && (
        <ActiveChips
          params={params}
          onReset={resetAll}
          onChange={(key, value) => {
            const next = new URLSearchParams(qs);
            if (value) next.set(key, value);
            else next.delete(key);
            next.delete("page");
            router.push(`/admin/peserta${next.size ? `?${next}` : ""}`);
          }}
        />
      )}

      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-danger-border bg-danger-soft p-4 text-sm font-medium text-danger">
          {error}
          <button type="button" onClick={retry} className="rounded-md border border-danger px-3 py-1.5 font-semibold">
            Coba lagi
          </button>
        </div>
      )}

      <div className={cn("grid items-start gap-5", isDashboard && "xl:grid-cols-[minmax(0,1fr)_300px]")}>
        <section aria-labelledby="tbl-h" className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="tbl-h" className="text-sm font-semibold text-ink">
              {isDashboard ? "Peserta terbaru" : "Daftar peserta"}
            </h2>
            {!isDashboard && (
              <p className="text-sm tabular-nums text-ink-muted">
                {list ? `${list.total.toLocaleString("id-ID")} peserta` : "—"}
              </p>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-white">
            <div role="region" aria-label="Tabel data peserta" aria-busy={loading || undefined} tabIndex={0} className="overflow-x-auto">
              <Table className={cn("min-w-0", !isDashboard && "lg:min-w-[900px]")}>
                <caption className="sr-only">Daftar peserta pendataan KTA IKADI</caption>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="hidden text-xs font-medium text-ink-muted md:table-cell" aria-sort={ariaSort(params.get("sort"), "date")}>
                      <SortButton label="Tanggal" current={params.get("sort") ?? "newest"} asc="oldest" desc="newest" qs={qs} />
                    </TableHead>
                    <TableHead className="text-xs font-medium text-ink-muted" aria-sort={ariaSort(params.get("sort"), "name")}>
                      <SortButton label="Nama" current={params.get("sort") ?? "newest"} asc="name_asc" desc="name_desc" qs={qs} />
                    </TableHead>
                    {!isDashboard && <TableHead className="hidden text-xs font-medium text-ink-muted lg:table-cell">NIK</TableHead>}
                    <TableHead className="hidden text-xs font-medium text-ink-muted sm:table-cell">Nomor anggota</TableHead>
                    {!isDashboard && (
                      <>
                        <TableHead className="hidden text-xs font-medium text-ink-muted md:table-cell">Asal IKADI</TableHead>
                        <TableHead className="hidden text-xs font-medium text-ink-muted xl:table-cell">WhatsApp</TableHead>
                      </>
                    )}
                    <TableHead className="text-right text-xs font-medium text-ink-muted">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && <SkeletonRows columns={isDashboard ? 4 : 7} />}
                  {!loading && list?.data.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="hidden whitespace-nowrap text-xs tabular-nums text-ink-muted md:table-cell">{formatDateTime(p.createdAt)}</TableCell>
                      <TableCell>
                        <span className="font-medium text-ink">{p.fullName}</span>
                        <span className="mt-0.5 block text-xs text-ink-muted">{p.levelLabel}</span>
                        <span className="mt-0.5 block font-mono text-xs tabular-nums text-ink-muted sm:hidden">
                          {p.memberNumber ?? "Belum terbit"}
                        </span>
                      </TableCell>
                      {!isDashboard && <TableCell className="hidden whitespace-nowrap font-mono text-xs tabular-nums tracking-wide text-ink-muted lg:table-cell">{p.nikMasked}</TableCell>}
                      <TableCell className="hidden whitespace-nowrap font-mono text-xs tabular-nums sm:table-cell">
                        {p.memberNumber ?? <Badge variant="pd">Menunggu</Badge>}
                      </TableCell>
                      {!isDashboard && (
                        <>
                          <TableCell className="hidden md:table-cell">
                            <div className="flex items-center gap-1.5">
                              <OriginBadge type={p.originType} />
                              <span className="text-sm text-ink">{p.originName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden whitespace-nowrap font-mono text-xs tabular-nums text-ink-muted xl:table-cell">{p.whatsappMasked}</TableCell>
                        </>
                      )}
                      <TableCell className="text-right">
                        <Link
                          href={`/admin/peserta/${p.id}`}
                          aria-label={`Buka detail ${p.fullName}`}
                          className="inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-sm font-medium text-primary transition-colors hover:bg-primary-soft md:min-h-0 md:py-1"
                        >
                          Detail
                          <ArrowRight aria-hidden className="size-3.5" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {!loading && list && list.data.length === 0 && (
                <EmptyState
                  title={hasFilter ? "Tidak ada peserta yang cocok" : "Belum ada peserta"}
                  description={hasFilter ? "Ubah kata kunci atau filter yang dipakai." : "Data akan muncul di sini setelah formulir pendaftaran dikirim."}
                  action={hasFilter ? <Button variant="secondary" size="sm" onClick={resetAll}>Reset filter</Button> : undefined}
                />
              )}
            </div>
          </div>

          {!isDashboard && !loading && list && list.data.length > 0 && (
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

        {isDashboard && <DashboardAside list={list} stats={stats} loading={loading} />}
      </div>
    </div>
  );
}

function DashboardAside({ list, stats, loading }: { list: ListResponse | null; stats: Stats | null; loading: boolean }) {
  const pending = list?.data.filter((p) => !p.memberNumber).slice(0, 5) ?? [];
  const remaining = stats?.kta?.remaining;
  const limit = stats?.kta?.limit;
  const percent = limit ? Math.min(100, Math.round(((remaining ?? 0) / limit) * 100)) : 0;

  return (
    <aside className="space-y-4">
      <section aria-labelledby="pending-h" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="pending-h" className="text-sm font-semibold text-ink">
            Menunggu terbit
          </h2>
          <span className="text-xs text-ink-muted">10 terbaru</span>
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          {loading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-9 animate-pulse rounded bg-border/60" />
              ))}
            </div>
          ) : pending.length === 0 ? (
            <p className="px-4 py-6 text-sm leading-relaxed text-ink-muted">
              Tidak ada peserta yang menunggu penerbitan.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {pending.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/admin/peserta/${p.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-bg"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">{p.fullName}</span>
                      <span className="block truncate text-xs text-ink-muted">{p.originName}</span>
                    </span>
                    <ArrowRight aria-hidden className="size-4 shrink-0 text-ink-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-border px-4 py-2.5">
            <Link href="/admin/peserta" className="text-sm font-medium text-primary hover:text-primary-hover">
              Semua peserta
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-white p-4">
        <h2 className="text-sm font-semibold text-ink">Kuota cetak</h2>
        <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-ink">
          {remaining ?? "—"}
          <span className="text-sm font-normal text-ink-muted"> / {limit ?? "—"}</span>
        </p>
        <div
          className="mt-2 h-1 overflow-hidden rounded-full bg-border"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={limit ?? 0}
          aria-valuenow={remaining ?? 0}
          aria-label="Sisa kuota cetak"
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-ink-muted">Sisa kartu yang dapat dicetak.</p>
      </section>
    </aside>
  );
}

function setPage(router: ReturnType<typeof useRouter>, qs: string, page: number) {
  const next = new URLSearchParams(qs);
  if (page > 1) next.set("page", String(page));
  else next.delete("page");
  router.push(`/admin/peserta${next.size ? `?${next}` : ""}`);
}

function ariaSort(current: string | null, col: "date" | "name"): "ascending" | "descending" | "none" {
  if (col === "date") {
    if (current === "oldest") return "ascending";
    if (!current || current === "newest") return "descending";
  } else {
    if (current === "name_asc") return "ascending";
    if (current === "name_desc") return "descending";
  }
  return "none";
}

function SortButton({ label, current, asc, desc, qs }: { label: string; current: string; asc: string; desc: string; qs: string }) {
  const isAsc = current === asc;
  const next = isAsc ? desc : current === desc ? asc : desc;
  const params = new URLSearchParams(qs);
  params.set("sort", next);
  params.delete("page");
  const active = current === asc || current === desc;
  return (
    <Link
      href={`/admin/peserta?${params}`}
      className="inline-flex min-h-10 items-center gap-1 font-medium hover:text-ink md:min-h-0"
    >
      {label}
      <ArrowUpDown aria-hidden className={`size-3 shrink-0 ${active ? "text-primary" : "text-border"}`} />
    </Link>
  );
}

function FiltersPanel({ params, onApply }: { params: URLSearchParams; onApply: (nextQs: string) => void }) {
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
  const [open, setOpen] = useState(() => Object.values(initial).some((v) => v !== ""));
  const set = (k: keyof typeof values) => (v: string) => setValues((prev) => ({ ...prev, [k]: v }));
  const activeCount = (FILTER_KEYS.filter((k) => k !== "q") as (keyof typeof initial)[]).filter((k) => initial[k]).length;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(values)) if (v.trim()) next.set(k, v.trim());
    const sort = params.get("sort");
    if (sort) next.set("sort", sort);
    onApply(next.toString());
  };

  const reset = () => {
    setValues({ q: "", originType: "", originName: "", education: "", sermon: "", dateFrom: "", dateTo: "" });
    const next = new URLSearchParams();
    const sort = params.get("sort");
    if (sort) next.set("sort", sort);
    onApply(next.toString());
  };

  return (
    <form onSubmit={submit} className="rounded-xl border border-border bg-white">
      <div className="flex flex-col gap-2 p-3 sm:flex-row">
        <div className="relative flex-1">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
          <Input
            id="filter-q"
            type="search"
            value={values.q}
            onChange={(e) => set("q")(e.target.value)}
            placeholder="Cari nama, NIK, WhatsApp, atau nomor anggota"
            className="h-10 pl-9"
            aria-label="Cari peserta"
          />
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="h-10">
            Filter{activeCount > 0 ? ` (${activeCount})` : ""}
          </Button>
          <Button type="submit" className="h-10">
            Cari
          </Button>
        </div>
      </div>

      {open && (
        <>
          <div className="grid gap-4 border-t border-border p-4 sm:grid-cols-2 lg:grid-cols-3">
            <FilterFields values={values} set={set} />
          </div>
          <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
            <Button type="button" variant="secondary" onClick={reset}>
              Reset
            </Button>
            <Button type="submit">Terapkan</Button>
          </div>
        </>
      )}
    </form>
  );
}

type FilterValues = { q: string; originType: string; originName: string; education: string; sermon: string; dateFrom: string; dateTo: string };

function FilterFields({ values, set }: { values: FilterValues; set: (k: keyof FilterValues) => (v: string) => void }) {
  return (
    <>
      <div className="space-y-1.5">
        <label htmlFor="f-origin" className="block text-sm font-medium text-ink">Asal IKADI</label>
        <SearchSelect
          id="f-origin"
          value={values.originType}
          onValueChange={(v) => set("originType")(v)}
          options={[
            { value: "", label: "Semua" },
            { value: "PW", label: "PW" },
            { value: "PD", label: "PD" },
          ]}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="f-origin-name" className="block text-sm font-medium text-ink">Nama PW/PD IKADI</label>
        <Input id="f-origin-name" type="text" value={values.originName} onChange={(e) => set("originName")(e.target.value)} placeholder="Contoh: PW Jawa Timur" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="f-education" className="block text-sm font-medium text-ink">Pendidikan terakhir</label>
        <SearchSelect
          id="f-education"
          value={values.education}
          onValueChange={(v) => set("education")(v)}
          options={[{ value: "", label: "Semua" }, ...EDUCATION_OPTIONS.map((o) => ({ value: o, label: o }))]}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="f-sermon" className="block text-sm font-medium text-ink">Pengalaman khutbah</label>
        <SearchSelect
          id="f-sermon"
          value={values.sermon}
          onValueChange={(v) => set("sermon")(v)}
          options={[{ value: "", label: "Semua" }, ...Object.entries(SERMON_LABELS).map(([v, text]) => ({ value: v, label: text }))]}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="f-from" className="block text-sm font-medium text-ink">Tanggal input dari</label>
        <Input id="f-from" type="date" value={values.dateFrom} onChange={(e) => set("dateFrom")(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="f-to" className="block text-sm font-medium text-ink">Tanggal input sampai</label>
        <Input id="f-to" type="date" value={values.dateTo} onChange={(e) => set("dateTo")(e.target.value)} />
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

function ActiveChips({ params, onReset, onChange }: { params: URLSearchParams; onReset: () => void; onChange: (key: string, value: string) => void }) {
  const chips = FILTER_KEYS.flatMap((k) => {
    const v = params.get(k);
    return v ? [{ key: k, value: v }] : [];
  });
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map(({ key, value }) => (
        <span key={key} className="inline-flex items-center gap-1 rounded-md border border-primary/25 bg-primary-soft py-1 pl-2.5 pr-1 text-xs font-medium text-primary-ink">
          {CHIP_LABELS[key]?.(value) ?? `${key}: ${value}`}
          <button
            type="button"
            onClick={() => onChange(key, "")}
            aria-label={`Hapus filter ${CHIP_LABELS[key]?.(value) ?? key}`}
            className="inline-flex size-6 items-center justify-center rounded hover:bg-primary/10"
          >
            <span aria-hidden>×</span>
          </button>
        </span>
      ))}
      <button type="button" onClick={onReset} className="text-sm font-medium text-primary underline-offset-2 hover:underline">
        Hapus semua
      </button>
    </div>
  );
}

function SkeletonRows({ columns = 7 }: { columns?: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i} aria-hidden>
          {Array.from({ length: columns }).map((__, j) => (
            <TableCell key={j}><div className="h-4 animate-pulse rounded bg-border/70" /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function AdminSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Memuat data">
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse rounded bg-border/70" />
        <div className="h-4 w-80 animate-pulse rounded bg-border/50" />
      </div>
      <div className="h-20 animate-pulse rounded-xl border border-border bg-white" />
      <div className="h-72 animate-pulse rounded-xl border border-border bg-white" />
    </div>
  );
}
