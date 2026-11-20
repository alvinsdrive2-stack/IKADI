"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { animate, stagger } from "animejs";
import { ArrowRight, ArrowUpDown, Search } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { PageBanner } from "@/components/PageBanner";
import { Pagination } from "@/components/Pagination";
import { SessionExpired } from "@/components/AdminNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchSelect } from "@/components/ui/search-select";
import { BulkActions } from "@/components/BulkActions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/components/constants";
import { cn } from "@/lib/utils";

export type ParticipantRow = {
  id: string | number;
  createdAt: string;
  fullName: string;
  nikMasked: string;
  whatsappMasked: string;
  lastEducation: string | null;
  memberNumber: string | null;
  levelCode: number;
  levelLabel: string;
  /** Nama sumber data (mis. MUNAS). null = mendaftar sendiri lewat IKADI. */
  sourceLabel?: string | null;
};

type ListResponse = { ok: boolean; data: ParticipantRow[]; total: number; page: number; perPage: number; totalPages: number };
type Stats = { total: number; today: number; ktaPrinted: number };

const FILTER_KEYS = ["q", "education", "source", "level", "kta", "dateFrom", "dateTo"] as const;

/** Level kepengurusan untuk filter "Role". Sama dengan LEVEL_LABELS. */
const LEVEL_OPTIONS: { value: string; label: string }[] = [
  { value: "1", label: "Pengurus Pusat" },
  { value: "2", label: "Pengurus Wilayah" },
  { value: "3", label: "Pengurus Daerah" },
  { value: "4", label: "Pengurus Cabang" },
  { value: "5", label: "Pengurus Ranting" },
  { value: "6", label: "Anggota" },
  { value: "7", label: "Purnabakti / Mantan Pengurus" },
];

export function AdminParticipants({
  mode = "list",
  basePath = "/admin/peserta",
  apiBase = "/api/admin/participants",
  statsUrl = "/api/admin/stats",
  bulkExportBase = "/api/admin/bulk/kta",
  bulkIssueUrl = "/api/admin/bulk/terbitkan",
  sourceOptions = [],
}: {
  mode?: "dashboard" | "list";
  /** Halaman detail peserta. Admin: /admin/peserta, pengurus: /anggota/pengurus/anggota. */
  basePath?: string;
  /** Endpoint daftar. Dipakai bersama admin & pengurus. */
  apiBase?: string;
  /** Endpoint ringkasan. `null` = tidak ada ringkasan lintas cakupan untuk peran ini. */
  statsUrl?: string | null;
  /** Endpoint pekerjaan ekspor massal (PDF/JPG → ZIP). */
  bulkExportBase?: string;
  /** Endpoint penerbitan nomor massal. */
  bulkIssueUrl?: string;
  /** Pilihan filter sumber data, diambil dari `data_sources` oleh halaman server. */
  sourceOptions?: { value: string; label: string }[];
}) {
  const searchParams = useSearchParams();
  return (
    <AdminData
      qs={searchParams.toString()}
      mode={mode}
      basePath={basePath}
      apiBase={apiBase}
      statsUrl={statsUrl}
      bulkExportBase={bulkExportBase}
      bulkIssueUrl={bulkIssueUrl}
      sourceOptions={sourceOptions}
    />
  );
}

function AdminData({
  qs,
  mode,
  basePath,
  apiBase,
  statsUrl,
  bulkExportBase,
  bulkIssueUrl,
  sourceOptions,
}: {
  qs: string;
  mode: "dashboard" | "list";
  basePath: string;
  apiBase: string;
  statsUrl: string | null;
  bulkExportBase: string;
  bulkIssueUrl: string;
  sourceOptions: { value: string; label: string }[];
}) {
  const router = useRouter();
  const params = new URLSearchParams(qs);
  const query = mode === "dashboard" ? "perPage=10&sort=newest" : qs;
  const [result, setResult] = useState<{ qs: string; list: ListResponse | null; stats: Stats | null; error: string | null; unauthorized: boolean }>({
    qs: "", list: null, stats: null, error: null, unauthorized: false,
  });

  // Pilihan centang tabel disimpan bersama query asalnya: begitu filter atau
  // halaman berubah, query tidak cocok lagi dan pilihan otomatis kosong -
  // tanpa effect yang memicu render berantai.
  const [selection, setSelection] = useState<{ qs: string; ids: string[] }>({ qs: query, ids: [] });
  const selected = selection.qs === query ? selection.ids : [];
  const setSelected = useCallback(
    (next: string[] | ((prev: string[]) => string[])) => {
      setSelection((prev) => {
        const base = prev.qs === query ? prev : { qs: query, ids: [] };
        return { qs: query, ids: typeof next === "function" ? next(base.ids) : next };
      });
    },
    [query],
  );
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    Promise.all([
      fetch(`${apiBase}?${query}`, { signal: ctrl.signal, cache: "no-store", credentials: "same-origin" }),
      statsUrl
        ? fetch(statsUrl, { signal: ctrl.signal, cache: "no-store", credentials: "same-origin" })
        : Promise.resolve(null),
    ])
      .then(async ([listRes, statsRes]) => {
        if (listRes.status === 401 || listRes.status === 403 || statsRes?.status === 401) {
          return { qs: query, list: null, stats: null, error: null, unauthorized: true };
        }
        if (!listRes.ok || (statsRes && !statsRes.ok)) throw new Error("Gagal memuat data.");
        return {
          qs: query,
          list: (await listRes.json()) as ListResponse,
          stats: statsRes ? ((await statsRes.json()) as Stats) : null,
          error: null,
          unauthorized: false,
        };
      })
      .then(setResult)
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setResult({ qs: query, list: null, stats: null, error: "Gagal memuat data.", unauthorized: false });
      });
    return () => ctrl.abort();
  }, [query, apiBase, statsUrl, reloadKey]);

  const fresh = result.qs === query;
  const list = fresh ? result.list : null;
  const stats = fresh ? result.stats : null;
  const error = fresh ? result.error : null;
  const unauthorized = fresh && result.unauthorized;
  const loading = !fresh;
  const retry = () => setResult((prev) => ({ ...prev, qs: "" }));

  // Baris masuk berurutan setelah data baru datang, jadi perubahan filter
  // terasa sebagai hasil yang muncul, bukan tabel yang berkedip.
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  useEffect(() => {
    if (loading || !list?.data.length) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rows = bodyRef.current?.querySelectorAll("tr");
    if (!rows?.length) return;
    animate(rows, {
      y: [10, 0],
      opacity: [0.4, 1],
      duration: 380,
      delay: stagger(22, { start: 40 }),
      ease: "outQuart",
    });
  }, [query, loading, list?.data.length]);
  const hasFilter = FILTER_KEYS.some((k) => params.get(k));
  const resetAll = () => router.push(basePath);
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
              <Link href={basePath}>
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

      {statsUrl && (
      <section aria-labelledby="stats-h" className="rounded-xl border border-border bg-white">
        <h2 id="stats-h" className="sr-only">Ringkasan data</h2>
        <dl className="grid grid-cols-2 divide-border sm:grid-cols-4 sm:divide-x">
          {[
            { label: "Total peserta", value: stats?.total },
            { label: "Masuk hari ini", value: stats?.today },
          ].map((s) => (
            <div key={s.label} className="border-b border-border px-5 py-4 sm:border-b-0">
              <dt className="text-xs text-ink-muted">{s.label}</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-ink">
                {loading || s.value === undefined ? "-" : s.value.toLocaleString("id-ID")}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      )}

      {!isDashboard && (
        <FiltersPanel
          params={params}
          sourceOptions={sourceOptions}
          onApply={(next) => router.push(`${basePath}${next ? `?${next}` : ""}`)}
        />
      )}

      {!isDashboard && (
        <BulkActions
          selected={selected}
          filterQuery={qs}
          issueUrl={bulkIssueUrl}
          exportBase={bulkExportBase}
          onClear={() => setSelected([])}
          onIssued={() => setReloadKey((k) => k + 1)}
        />
      )}

      {!isDashboard && hasFilter && (
        <ActiveChips
          params={params}
          sourceOptions={sourceOptions}
          onReset={resetAll}
          onChange={(key, value) => {
            const next = new URLSearchParams(qs);
            if (value) next.set(key, value);
            else next.delete(key);
            next.delete("page");
            router.push(`${basePath}${next.size ? `?${next}` : ""}`);
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
                {list ? `${list.total.toLocaleString("id-ID")} peserta` : "-"}
              </p>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-white">
            <div role="region" aria-label="Tabel data peserta" aria-busy={loading || undefined} tabIndex={0} className="overflow-x-auto">
              <Table className={cn("min-w-0", !isDashboard && "lg:min-w-[900px]")}>
                <caption className="sr-only">Daftar peserta pendataan KTA IKADI</caption>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {!isDashboard && (
                      <TableHead className="w-10">
                        <input
                          type="checkbox"
                          aria-label="Pilih semua peserta di halaman ini"
                          checked={!!list && list.data.length > 0 && selected.length === list.data.length}
                          onChange={(e) =>
                            setSelected(e.target.checked ? (list?.data.map((p) => String(p.id)) ?? []) : [])
                          }
                          className="size-4 rounded border-control-border"
                        />
                      </TableHead>
                    )}
                    <TableHead className="hidden text-xs font-medium text-ink-muted md:table-cell" aria-sort={ariaSort(params.get("sort"), "date")}>
                      <SortButton label="Tanggal" current={params.get("sort") ?? "newest"} asc="oldest" desc="newest" qs={qs} basePath={basePath} />
                    </TableHead>
                    <TableHead className="text-xs font-medium text-ink-muted" aria-sort={ariaSort(params.get("sort"), "name")}>
                      <SortButton label="Nama" current={params.get("sort") ?? "newest"} asc="name_asc" desc="name_desc" qs={qs} basePath={basePath} />
                    </TableHead>
                    {!isDashboard && <TableHead className="hidden text-xs font-medium text-ink-muted lg:table-cell">NIK</TableHead>}
                    <TableHead className="hidden text-xs font-medium text-ink-muted sm:table-cell">Nomor anggota</TableHead>
                    {!isDashboard && (
                      <>
                        <TableHead className="hidden text-xs font-medium text-ink-muted xl:table-cell">WhatsApp</TableHead>
                      </>
                    )}
                    <TableHead className="text-right text-xs font-medium text-ink-muted">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody ref={bodyRef}>
                  {loading && <SkeletonRows columns={isDashboard ? 4 : 8} />}
                  {!loading && list?.data.map((p) => (
                    <TableRow key={p.id} data-selected={selected.includes(String(p.id)) || undefined}>
                      {!isDashboard && (
                        <TableCell className="w-10">
                          <input
                            type="checkbox"
                            aria-label={`Pilih ${p.fullName}`}
                            checked={selected.includes(String(p.id))}
                            onChange={(e) =>
                              setSelected((prev) =>
                                e.target.checked ? [...prev, String(p.id)] : prev.filter((x) => x !== String(p.id)),
                              )
                            }
                            className="size-4 rounded border-control-border"
                          />
                        </TableCell>
                      )}
                      <TableCell className="hidden whitespace-nowrap text-xs tabular-nums text-ink-muted md:table-cell">{formatDateTime(p.createdAt)}</TableCell>
                      <TableCell>
                        <span className="font-medium text-ink">{p.fullName}</span>
                        <span className="mt-0.5 block text-xs text-ink-muted">
                          {p.levelLabel}
                          {p.sourceLabel && ` · ${p.sourceLabel}`}
                        </span>
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
                          <TableCell className="hidden whitespace-nowrap font-mono text-xs tabular-nums text-ink-muted xl:table-cell">{p.whatsappMasked}</TableCell>
                        </>
                      )}
                      <TableCell className="text-right">
                        <Link
                          href={`${basePath}/${p.id}`}
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
              onPrev={() => setPage(router, qs, list.page - 1, basePath)}
              onNext={() => setPage(router, qs, list.page + 1, basePath)}
            />
          )}
        </section>

        {isDashboard && <DashboardAside list={list} stats={stats} loading={loading} basePath={basePath} />}
      </div>
    </div>
  );
}

function DashboardAside({ list, stats, loading, basePath }: { list: ListResponse | null; stats: Stats | null; loading: boolean; basePath: string }) {
  const pending = list?.data.filter((p) => !p.memberNumber).slice(0, 5) ?? [];
  const totalTerbit = stats?.ktaPrinted;

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
                    href={`${basePath}/${p.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-bg"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">{p.fullName}</span>
                      <span className="block truncate text-xs text-ink-muted">{p.levelLabel}</span>
                    </span>
                    <ArrowRight aria-hidden className="size-4 shrink-0 text-ink-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-border px-4 py-2.5">
            <Link href={basePath} className="text-sm font-medium text-primary hover:text-primary-hover">
              Semua peserta
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-white p-4">
        <h2 className="text-sm font-semibold text-ink">KTA terbit</h2>
        <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-ink">
          {totalTerbit === undefined ? "-" : totalTerbit.toLocaleString("id-ID")}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-ink-muted">
          Total nomor anggota yang sudah diterbitkan. Cetak ulang tidak menambah hitungan ini.
        </p>
      </section>
    </aside>
  );
}

function setPage(router: ReturnType<typeof useRouter>, qs: string, page: number, basePath: string) {
  const next = new URLSearchParams(qs);
  if (page > 1) next.set("page", String(page));
  else next.delete("page");
  router.push(`${basePath}${next.size ? `?${next}` : ""}`);
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

function SortButton({ label, current, asc, desc, qs, basePath }: { label: string; current: string; asc: string; desc: string; qs: string; basePath: string }) {
  const isAsc = current === asc;
  const next = isAsc ? desc : current === desc ? asc : desc;
  const params = new URLSearchParams(qs);
  params.set("sort", next);
  params.delete("page");
  const active = current === asc || current === desc;
  return (
    <Link
      href={`${basePath}?${params}`}
      className="inline-flex min-h-10 items-center gap-1 font-medium hover:text-ink md:min-h-0"
    >
      {label}
      <ArrowUpDown aria-hidden className={`size-3 shrink-0 ${active ? "text-primary" : "text-border"}`} />
    </Link>
  );
}

function FiltersPanel({
  params,
  onApply,
  sourceOptions,
}: {
  params: URLSearchParams;
  onApply: (nextQs: string) => void;
  sourceOptions: { value: string; label: string }[];
}) {
  const initial = {
    q: params.get("q") ?? "",
    source: params.get("source") ?? "",
    level: params.get("level") ?? "",
    kta: params.get("kta") ?? "",
    dateFrom: params.get("dateFrom") ?? "",
    dateTo: params.get("dateTo") ?? "",
  };
  const [values, setValues] = useState(initial);
  const [open, setOpen] = useState(() => Object.values(initial).some((v) => v !== ""));
  const set = (k: keyof typeof values) => (v: string) => setValues((prev) => ({ ...prev, [k]: v }));
  const activeCount = (FILTER_KEYS.filter((k) => k !== "q") as (keyof typeof initial)[])
    .filter((k) => k in initial)
    .filter((k) => initial[k]).length;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(values)) if (v.trim()) next.set(k, v.trim());
    const sort = params.get("sort");
    if (sort) next.set("sort", sort);
    onApply(next.toString());
  };

  /**
   * Status KTA satu klik: tulis langsung ke URL tanpa lewat "Terapkan", supaya
   * terasa seperti tab. Filter lain yang sedang diisi ikut terbawa.
   */
  const setKtaNow = (v: string) => {
    setValues((prev) => ({ ...prev, kta: v }));
    const next = new URLSearchParams(params.toString());
    if (v) next.set("kta", v);
    else next.delete("kta");
    next.delete("page");
    onApply(next.toString());
  };

  const reset = () => {
    setValues({ q: "", source: "", level: "", kta: "", dateFrom: "", dateTo: "" });
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
        <div className="flex flex-wrap gap-2">
          {/* Status KTA sengaja di luar panel: pertanyaan yang paling sering
              ditanyakan ("mana yang belum terbit?") harus satu klik. */}
          <KtaSegmented value={values.kta} onChange={setKtaNow} className="h-10" />
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
            <FilterFields values={values} set={set} sourceOptions={sourceOptions} />
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

type FilterValues = { q: string; source: string; level: string; kta: string; dateFrom: string; dateTo: string };

const KTA_OPTIONS = [
  { value: "", label: "Semua" },
  { value: "terbit", label: "Sudah terbit" },
  { value: "menunggu", label: "Menunggu" },
] as const;

/**
 * Segmented control untuk status KTA. Satu klik langsung menetapkan filter,
 * tanpa perlu buka panel lalu tekan "Terapkan" seperti filter lain.
 */
function KtaSegmented({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const groupRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const group = groupRef.current;
    if (!group) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Indikator aktif "menetas" ke ukurannya: cukup transform, tidak menyentuh
    // layout, jadi daftar di bawahnya tidak ikut bergeser.
    const active = group.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!active) return;
    animate(active, {
      scale: [0.92, 1],
      duration: 260,
      ease: "outBack(1.6)",
    });
  }, [value]);

  return (
    <div
      ref={groupRef}
      role="group"
      aria-label="Status KTA"
      className={cn(
        // Scroll horizontal di layar sempit; tidak pernah memaksa lebar halaman.
        "inline-flex max-w-full shrink-0 items-center overflow-x-auto rounded-lg border border-border bg-bg p-0.5",
        className,
      )}
    >
      {KTA_OPTIONS.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value || "all"}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={cn(
              "min-h-8 shrink-0 rounded-md px-3 text-sm font-medium transition-colors",
              active ? "bg-white text-ink shadow-sm" : "text-ink-muted hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function FilterFields({
  values,
  set,
  sourceOptions,
}: {
  values: FilterValues;
  set: (k: keyof FilterValues) => (v: string) => void;
  sourceOptions: { value: string; label: string }[];
}) {
  return (
    <>
      <div className="space-y-1.5">
        <label htmlFor="f-source" className="block text-sm font-medium text-ink">Sumber data</label>
        <SearchSelect
          id="f-source"
          value={values.source}
          onValueChange={(v) => set("source")(v)}
          options={[{ value: "", label: "Semua" }, ...sourceOptions]}
          disabled={sourceOptions.length === 0}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="f-level" className="block text-sm font-medium text-ink">Role</label>
        <SearchSelect
          id="f-level"
          value={values.level}
          onValueChange={(v) => set("level")(v)}
          options={[{ value: "", label: "Semua" }, ...LEVEL_OPTIONS]}
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
  source: (v) => `Sumber: ${v === "mandiri" ? "Daftar mandiri" : v}`,
  level: (v) => `Role: ${LEVEL_OPTIONS.find((o) => o.value === v)?.label ?? v}`,
  kta: (v) => `KTA: ${v === "terbit" ? "Sudah terbit" : "Menunggu"}`,
  dateFrom: (v) => `Dari: ${v}`,
  dateTo: (v) => `Sampai: ${v}`,
};

function ActiveChips({
  params,
  onReset,
  onChange,
  sourceOptions,
}: {
  params: URLSearchParams;
  onReset: () => void;
  onChange: (key: string, value: string) => void;
  sourceOptions: { value: string; label: string }[];
}) {
  const chipLabel = (key: string, value: string) => {
    if (key === "source") {
      return `Sumber: ${sourceOptions.find((o) => o.value === value)?.label ?? value}`;
    }
    return CHIP_LABELS[key]?.(value) ?? `${key}: ${value}`;
  };
  const chips = FILTER_KEYS.flatMap((k) => {
    const v = params.get(k);
    return v ? [{ key: k, value: v }] : [];
  });
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map(({ key, value }) => (
        <span key={key} className="inline-flex items-center gap-1 rounded-md border border-primary/25 bg-primary-soft py-1 pl-2.5 pr-1 text-xs font-medium text-primary-ink">
          {chipLabel(key, value)}
          <button
            type="button"
            onClick={() => onChange(key, "")}
            aria-label={`Hapus filter ${chipLabel(key, value)}`}
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
