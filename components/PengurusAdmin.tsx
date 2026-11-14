"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShieldCheck, ShieldOff, UserRoundPlus } from "lucide-react";
import { Alert } from "@/components/Alert";
import { PageBanner } from "@/components/PageBanner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchSelect } from "@/components/ui/search-select";
import { LEVEL_LABELS } from "@/lib/member-number";

type PengurusRow = {
  id: string;
  fullName: string;
  levelCode: number;
  levelLabel: string;
  provinceName: string | null;
  regencyName: string | null;
  memberNumber: string | null;
  membershipStatus: string;
  createdAt: string;
};

type Kandidat = {
  id: string;
  fullName: string;
  levelCode: number;
  levelLabel: string;
  memberNumber: string | null;
  wilayan: string;
};

type ListResponse = {
  ok: boolean;
  data: PengurusRow[];
  appointableLevels: number[];
  selfId: string;
};

type KandidatResponse = {
  ok: boolean;
  data: { id: string; fullName: string; levelLabel: string; memberNumber: string | null; levelCode: number }[];
  total: number;
};

type State =
  | { kind: "loading" }
  | { kind: "ok"; list: PengurusRow[]; appointable: number[]; selfId: string }
  | { kind: "unauthorized" }
  | { kind: "error" };

export function PengurusAdmin() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Form lantik
  const [cari, setCari] = useState("");
  const [kandidat, setKandidat] = useState<Kandidat[]>([]);
  const [cariBusy, setCariBusy] = useState(false);
  const [pilihId, setPilihId] = useState("");
  const [levelLantik, setLevelLantik] = useState("");

  const load = useCallback(() => {
    const ctrl = new AbortController();
    fetch("/api/anggota/pengurus/pengurus", { signal: ctrl.signal, cache: "no-store", credentials: "same-origin" })
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) return setState({ kind: "unauthorized" });
        if (!res.ok) return setState({ kind: "error" });
        const body = (await res.json()) as ListResponse;
        setState({
          kind: "ok",
          list: body.data,
          appointable: body.appointableLevels,
          selfId: body.selfId,
        });
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setState({ kind: "error" });
      });
    return () => ctrl.abort();
  }, []);

  useEffect(() => load(), [load, attempt]);

  // Cari calon peserta (dibatasi cakupan oleh server).
  useEffect(() => {
    const q = cari.trim();
    if (q.length < 2) {
      setKandidat([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setCariBusy(true);
      fetch(`/api/anggota/pengurus/anggota?q=${encodeURIComponent(q)}&perPage=10`, {
        signal: ctrl.signal,
        cache: "no-store",
        credentials: "same-origin",
      })
        .then(async (res) => (res.ok ? ((await res.json()) as KandidatResponse) : null))
        .then((body) => {
          if (!body) return;
          setKandidat(
            body.data.map((d) => ({
              id: d.id,
              fullName: d.fullName,
              levelCode: d.levelCode,
              levelLabel: d.levelLabel,
              memberNumber: d.memberNumber,
              wilayan: "",
            })),
          );
        })
        .catch(() => {})
        .finally(() => setCariBusy(false));
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [cari]);

  const pengurusById = useMemo(
    () => new Map(state.kind === "ok" ? state.list.map((r) => [r.id, r]) : []),
    [state],
  );

  const kirim = async (id: string, body: { isPengurus: boolean; levelCode?: number }, sukses: string) => {
    setBusyId(id);
    setNotice(null);
    try {
      const res = await fetch(`/api/anggota/pengurus/pengurus/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setNotice({ tone: "error", text: String(data?.message ?? "Gagal menyimpan. Coba lagi.") });
        return false;
      }
      setNotice({ tone: "success", text: sukses });
      setAttempt((n) => n + 1);
      return true;
    } catch {
      setNotice({ tone: "error", text: "Koneksi bermasalah. Coba lagi." });
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const lantik = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pilihId || !levelLantik) {
      setNotice({ tone: "error", text: "Pilih peserta dan level dulu." });
      return;
    }
    const target = kandidat.find((k) => k.id === pilihId) ?? pengurusById.get(pilihId);
    if (target && "memberNumber" in target && target.memberNumber) {
      setNotice({
        tone: "error",
        text: "Nomor anggota peserta ini sudah terbit, jadi levelnya terkunci dan tidak bisa dilantik.",
      });
      return;
    }
    const ok = await kirim(pilihId, { isPengurus: true, levelCode: Number(levelLantik) }, "Pengurus berhasil dilantik.");
    if (ok) {
      setPilihId("");
      setLevelLantik("");
      setCari("");
      setKandidat([]);
    }
  };

  const cabut = async (row: PengurusRow) => {
    const yakin = window.confirm(
      `Cabut peran pengurus ${row.fullName}? Peserta tetap terdaftar sebagai anggota biasa.`,
    );
    if (!yakin) return;
    await kirim(row.id, { isPengurus: false }, `Peran pengurus ${row.fullName} dicabut.`);
  };

  if (state.kind === "loading") {
    return <div className="h-64 animate-pulse rounded-xl border border-border bg-white" />;
  }

  if (state.kind === "unauthorized") {
    return (
      <Alert tone="error">
        <span className="font-semibold">Akses pengurus tidak aktif.</span> Akun ini tidak punya akses menu pengurus.
      </Alert>
    );
  }

  if (state.kind === "error") {
    return (
      <Alert tone="error">
        Gagal memuat daftar pengurus.
        <div className="mt-2">
          <Button variant="secondary" size="sm" onClick={() => setAttempt((n) => n + 1)}>
            Coba lagi
          </Button>
        </div>
      </Alert>
    );
  }

  const levelOptions = state.appointable.map((l) => ({
    value: String(l),
    label: `${l} — ${LEVEL_LABELS[l] ?? l}`,
  }));

  return (
    <div className="space-y-5">
      <PageBanner
        headingId="pengurus-list-h"
        title="Pengurus"
        description="Angkat dan cabut peran pengurus di wilayah kerja Anda."
        image="/ornaments/1.svg"
        badge={<ShieldCheck aria-hidden className="size-4" />}
        back={{ href: "/anggota/pengurus", label: "Kembali ke ringkasan pengurus" }}
      />

      {notice && <Alert tone={notice.tone === "success" ? "success" : "error"}>{notice.text}</Alert>}

      <section className="rounded-xl border border-border bg-white p-5">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <UserRoundPlus aria-hidden className="size-4 text-primary" /> Lantik pengurus
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">
          Cari nama atau NIK peserta yang belum punya nomor anggota, lalu pilih level yang boleh Anda tetapkan.
        </p>

        <form onSubmit={lantik} className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="cari" className="block text-sm font-medium text-ink">
              Cari peserta
            </label>
            <input
              id="cari"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Nama atau NIK, minimal 2 karakter"
              className="h-11 w-full rounded-lg border border-input bg-surface px-3 text-base text-ink"
            />
            {cariBusy && <p className="text-xs text-ink-muted">Mencari…</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="kandidat" className="block text-sm font-medium text-ink">
              Peserta
            </label>
            <SearchSelect
              id="kandidat"
              options={
                kandidat.length
                  ? kandidat.map((k) => ({
                      value: k.id,
                      label: `${k.fullName}${k.memberNumber ? " · nomor sudah terbit" : ""}`,
                    }))
                  : [{ value: "", label: cari.length < 2 ? "Ketik nama dulu" : "Tidak ada hasil" }]
              }
              value={pilihId}
              placeholder="Pilih peserta"
              onValueChange={(v) => setPilihId(v)}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="level-lantik" className="block text-sm font-medium text-ink">
              Level
            </label>
            <SearchSelect
              id="level-lantik"
              options={[{ value: "", label: "Pilih level" }, ...levelOptions]}
              value={levelLantik}
              onValueChange={(v) => setLevelLantik(v)}
            />
          </div>

          <div className="flex items-end">
            <Button type="submit" disabled={busyId !== null || !pilihId || !levelLantik}>
              <ShieldCheck aria-hidden /> Lantik
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-border bg-white">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-ink">Pengurus aktif</h2>
          <p className="text-sm tabular-nums text-ink-muted">{state.list.length} orang</p>
        </div>
        {state.list.length === 0 ? (
          <p className="px-5 py-8 text-sm leading-relaxed text-ink-muted">
            Belum ada pengurus di wilayah kerja Anda.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {state.list.map((row) => {
              const diri = row.id === state.selfId;
              const wilayah = [row.provinceName, row.regencyName].filter(Boolean).join(" · ") || "—";
              return (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                      {row.fullName}
                      <Badge variant={row.levelCode <= 1 ? "pw" : "pd"}>{row.levelLabel}</Badge>
                      {diri && <span className="text-xs text-ink-muted">(Anda)</span>}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">{wilayah}</p>
                    <p className="mt-0.5 font-mono text-xs tabular-nums text-ink-muted">
                      {row.memberNumber ?? "Nomor belum terbit"}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={diri || busyId === row.id}
                    onClick={() => cabut(row)}
                    aria-label={`Cabut peran pengurus ${row.fullName}`}
                  >
                    <ShieldOff aria-hidden /> Cabut
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="text-sm leading-relaxed text-ink-muted">
        Butuh menetapkan level tanpa melantik? Buka{" "}
        <Link href="/anggota/pengurus/anggota" className="font-medium text-primary underline-offset-2 hover:underline">
          Anggota wilayah
        </Link>{" "}
        lalu pilih peserta.
      </p>
    </div>
  );
}
