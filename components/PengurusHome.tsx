"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Users } from "lucide-react";
import { Alert } from "@/components/Alert";
import { PageBanner } from "@/components/PageBanner";
import { Button } from "@/components/ui/button";
import { LEVEL_LABELS } from "@/lib/member-number";

type PengurusMe = {
  levelCode: number;
  levelLabel: string;
  provinceCode: string | null;
  provinceName: string | null;
  regencyCode: string | null;
  regencyName: string | null;
  appointableLevels: number[];
  counts: { anggota: number; pengurus: number };
};

type State =
  | { kind: "loading" }
  | { kind: "ok"; data: PengurusMe }
  | { kind: "unauthorized" }
  | { kind: "error" };

export function PengurusHome() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setState({ kind: "loading" });
    fetch("/api/anggota/pengurus/me", { signal: ctrl.signal, cache: "no-store", credentials: "same-origin" })
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) setState({ kind: "unauthorized" });
        else if (!res.ok) setState({ kind: "error" });
        else {
          const body = await res.json();
          setState({ kind: "ok", data: body.data as PengurusMe });
        }
      })
      .catch((err) => {
        if ((err as Error)?.name !== "AbortError") setState({ kind: "error" });
      });
    return () => ctrl.abort();
  }, [attempt]);

  if (state.kind === "loading") {
    return <div className="h-40 animate-pulse rounded-xl border border-border bg-white" />;
  }

  if (state.kind === "unauthorized") {
    return (
      <Alert tone="error">
        <span className="font-semibold">Akses pengurus tidak aktif.</span> Akun ini tidak punya akses menu
        pengurus. Hubungi pengurus yang berwenang atau admin.
      </Alert>
    );
  }

  if (state.kind === "error") {
    return (
      <Alert tone="error">
        Gagal memuat data.
        <div className="mt-2">
          <Button variant="secondary" size="sm" onClick={() => setAttempt((n) => n + 1)}>
            Coba lagi
          </Button>
        </div>
      </Alert>
    );
  }

  const d = state.data;
  const wilayah =
    [d.provinceName, d.regencyName].filter(Boolean).join(" · ") ||
    (d.levelCode <= 1 ? "Seluruh Indonesia" : "Wilayah belum diisi");

  const kartu = [
    { label: "Anggota dalam cakupan", value: d.counts.anggota, icon: Users },
    { label: "Pengurus dalam cakupan", value: d.counts.pengurus, icon: ShieldCheck },
  ];

  return (
    <div className="space-y-5">
      <PageBanner
        headingId="pengurus-h"
        title="Ringkasan pengurus"
        description={`${d.levelLabel} · ${wilayah}`}
        image="/ornaments/2.svg"
        badge={<ShieldCheck aria-hidden className="size-4" />}
      />

      <section aria-labelledby="cakupan-h" className="rounded-xl border border-border bg-white">
        <h2 id="cakupan-h" className="sr-only">Cakupan</h2>
        <dl className="grid grid-cols-2 divide-x divide-border">
          {kartu.map((k) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className="px-5 py-4">
                <dt className="flex items-center gap-1.5 text-xs text-ink-muted">
                  <Icon aria-hidden className="size-3.5 text-primary" />
                  {k.label}
                </dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-ink">
                  {k.value.toLocaleString("id-ID")}
                </dd>
              </div>
            );
          })}
        </dl>
      </section>

      <section className="rounded-xl border border-border bg-white p-5">
        <h2 className="text-sm font-semibold text-ink">Wewenang Anda</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
          Sebagai {d.levelLabel.toLowerCase()}, Anda bisa mengangkat pengurus level{" "}
          <strong className="font-semibold text-ink">
            {d.appointableLevels.map((l) => LEVEL_LABELS[l] ?? l).join(", ")}
          </strong>{" "}
          di wilayah kerja Anda. Menetapkan level saat mencetak KTA juga dibatasi sampai level itu.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/anggota/pengurus/anggota">
              <Users aria-hidden /> Anggota wilayah
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/anggota/pengurus/pengurus">
              <ShieldCheck aria-hidden /> Kelola pengurus
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
