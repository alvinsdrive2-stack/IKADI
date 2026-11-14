"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SessionExpired } from "@/components/AdminNav";
import { Alert } from "@/components/Alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect } from "@/components/ui/search-select";
import { PROVINCE_OPTIONS, regencyOptions, LEVEL_LABELS } from "@/components/WilayahOptions";
import { MEMBERSHIP_STATUS_LABELS, formatDate } from "@/components/constants";
import { PENGURUS_MAX_LEVEL } from "@/lib/pengurus";

const LEVEL_OPTIONS = Array.from({ length: 7 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1} — ${LEVEL_LABELS[i + 1]}`,
}));

const STATUS_OPTIONS = Object.entries(MEMBERSHIP_STATUS_LABELS).map(([value, label]) => ({
  value,
  label,
}));

type Membership = {
  participantId: string;
  fullName: string;
  levelCode: number;
  levelLabel: string;
  provinceCode: string | null;
  provinceName: string | null;
  regencyCode: string | null;
  regencyName: string | null;
  memberNumber: string | null;
  memberNumberIssuedAt: string | null;
  membershipStatus: "AKTIF" | "NONAKTIF" | "PUNABAKTI";
  hasPassword: boolean;
  isPengurus: boolean;
  eligible: boolean;
  ineligibleReason: string | null;
};

type State =
  | { kind: "loading" }
  | { kind: "ok"; data: Membership }
  | { kind: "notfound" }
  | { kind: "unauthorized" }
  | { kind: "error" };

export function MembershipAdmin({
  id,
  apiBase = "/api/admin/participants",
  detailPath = (pid) => `/admin/peserta/${encodeURIComponent(pid)}/kta`,
  allowedLevels,
}: {
  id: string;
  /** Endpoint keanggotaan. Pengurus memakai /api/anggota/pengurus/anggota. */
  apiBase?: string;
  /** Halaman cetak KTA untuk id ini. */
  detailPath?: (participantId: string) => string;
  /** Level yang boleh dipilih. Kosong = semua 1..7 (perilaku admin). */
  allowedLevels?: number[];
}) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  // Form state: diperbarui setiap GET/PATCH sukses.
  const [form, setForm] = useState<{
    levelCode: number;
    provinceCode: string;
    regencyCode: string;
    membershipStatus: Membership["membershipStatus"];
    isPengurus: boolean;
  }>({ levelCode: 6, provinceCode: "", regencyCode: "", membershipStatus: "AKTIF", isPengurus: false });
  const [newPassword, setNewPassword] = useState("");
  const [pwError, setPwError] = useState<string>();
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    const ctrl = new AbortController();
    fetch(`${apiBase}/${encodeURIComponent(id)}/membership`, {
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
          const d = body.data as Membership;
          setState({ kind: "ok", data: d });
          setForm({
            levelCode: d.levelCode,
            provinceCode: d.provinceCode ?? "",
            regencyCode: d.regencyCode ?? "",
            membershipStatus: d.membershipStatus,
            isPengurus: d.isPengurus === true,
          });
        }
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setState({ kind: "error" });
      });
    return () => ctrl.abort();
  }, [id, apiBase]);

  useEffect(() => {
    return load();
  }, [load, attempt]);

  if (state.kind === "loading") {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Memuat keanggotaan">
        <div className="h-48 animate-pulse rounded-xl border border-border bg-white" />
      </div>
    );
  }

  if (state.kind === "unauthorized") return <SessionExpired />;

  if (state.kind !== "ok") {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-3 rounded-xl border border-danger-border bg-danger-soft p-4 text-sm font-medium text-danger"
      >
        {state.kind === "notfound" ? "Data keanggotaan tidak ditemukan." : "Gagal memuat keanggotaan."}
        <button type="button" onClick={() => setAttempt((a) => a + 1)} className="rounded-md border border-danger px-3 py-1.5 font-semibold">
          Coba lagi
        </button>
      </div>
    );
  }

  const d = state.data;
  const levelOptions = allowedLevels?.length
    ? LEVEL_OPTIONS.filter((o) => allowedLevels.includes(Number(o.value)))
    : LEVEL_OPTIONS;
  const numberIssued = !!d.memberNumber;
  // Peran pengurus hanya berlaku untuk level 1..3.
  const bolehPengurus = form.levelCode >= 1 && form.levelCode <= PENGURUS_MAX_LEVEL;
  const locked = numberIssued; // nomor terbit -> level & wilayah tak bisa diubah

  const save = async (patch: Record<string, unknown>, successText: string) => {
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch(`${apiBase}/${encodeURIComponent(id)}/membership`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(patch),
      });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.data) {
        const next = body.data as Membership;
        setState({ kind: "ok", data: next });
        setForm({
          levelCode: next.levelCode,
          provinceCode: next.provinceCode ?? "",
          regencyCode: next.regencyCode ?? "",
          membershipStatus: next.membershipStatus,
          isPengurus: next.isPengurus === true,
        });
        setNotice({ tone: "success", text: successText });
        return true;
      }
      if (res.status === 401) {
        setState({ kind: "unauthorized" });
        return false;
      }
      setNotice({
        tone: "error",
        text: String(body?.message ?? "Gagal menyimpan. Coba lagi."),
      });
      return false;
    } catch {
      setNotice({ tone: "error", text: "Koneksi bermasalah. Coba lagi." });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const submitCore = async (e: React.FormEvent) => {
    e.preventDefault();
    // Kirim level/wilayah hanya kalau tidak terkunci (backend menolak kalau nomor sudah terbit).
    const patch: Record<string, unknown> = {
      membershipStatus: form.membershipStatus,
      isPengurus: form.isPengurus,
    };
    if (!locked) {
      patch.levelCode = form.levelCode;
      patch.provinceCode = form.provinceCode || null;
      patch.regencyCode = form.regencyCode || null;
    }
    await save(patch, "Keanggotaan disimpan.");
  };

  const resetPw = async () => {
    if (newPassword.length < 8) {
      setPwError("Sandi minimal 8 karakter.");
      return;
    }
    setPwError(undefined);
    const ok = await save({ newPassword }, "Sandi anggota diperbarui.");
    if (ok) setNewPassword("");
  };

  return (
    <section className="rounded-xl border border-border bg-white" aria-labelledby="membership-h">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h2 id="membership-h" className="text-sm font-semibold text-ink">
            Keanggotaan
          </h2>
          <p className="mt-1 text-sm text-ink-muted">Jenjang, wilayah, status, dan sandi untuk akses halaman anggota.</p>
        </div>
        <Badge variant={d.membershipStatus === "AKTIF" ? "success" : "secondary"}>
          {MEMBERSHIP_STATUS_LABELS[d.membershipStatus] ?? d.membershipStatus}
        </Badge>
      </div>

      <div className="space-y-6 p-5">
        {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

        <dl className="grid gap-x-8 gap-y-4 border-b border-border pb-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-ink-muted">Nomor anggota</dt>
            <dd className="mt-0.5 break-all font-mono text-base tabular-nums tracking-wide text-ink">
              {d.memberNumber ?? <span className="text-ink-muted">Belum terbit</span>}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">Tanggal terbit</dt>
            <dd className="mt-0.5 text-base text-ink">{d.memberNumberIssuedAt ? formatDate(d.memberNumberIssuedAt) : "—"}</dd>
          </div>
        </dl>

        {!d.eligible && d.ineligibleReason && (
          <p className="rounded-lg border border-accent/40 bg-accent-soft p-3 text-sm leading-relaxed text-accent-ink">
            {d.ineligibleReason}
          </p>
        )}

        <form onSubmit={submitCore} noValidate className="space-y-6">
          <div className="grid gap-5 md:grid-cols-2">
            <Field id="m-level" label="Jenjang" required hint={locked ? "Terpaku karena nomor sudah terbit." : undefined}>
              <SearchSelect
                id="m-level"
                options={levelOptions}
                value={String(form.levelCode)}
                disabled={locked || saving}
                onValueChange={(v) => setForm((f) => ({ ...f, levelCode: Number(v) }))}
              />
            </Field>

            <Field id="m-status" label="Status keanggotaan" required>
              <SearchSelect
                id="m-status"
                options={STATUS_OPTIONS}
                value={form.membershipStatus}
                disabled={saving}
                onValueChange={(v) => setForm((f) => ({ ...f, membershipStatus: v as Membership["membershipStatus"] }))}
              />
            </Field>

            <Field id="m-province" label="Provinsi" hint={locked ? "Terpaku karena nomor sudah terbit." : undefined}>
              <SearchSelect
                id="m-province"
                options={PROVINCE_OPTIONS}
                value={form.provinceCode}
                placeholder="Pilih provinsi"
                disabled={locked || saving}
                onValueChange={(code) => {
                  setForm((f) => ({ ...f, provinceCode: code, regencyCode: "" }));
                }}
              />
            </Field>

            <Field id="m-regency" label="Kabupaten/Kota" hint={locked ? "Terpaku karena nomor sudah terbit." : undefined}>
              <SearchSelect
                id="m-regency"
                options={regencyOptions(form.provinceCode)}
                value={form.regencyCode}
                placeholder={form.provinceCode ? "Pilih kabupaten/kota" : "Pilih provinsi dulu"}
                disabled={locked || saving || !form.provinceCode}
                onValueChange={(v) => setForm((f) => ({ ...f, regencyCode: v }))}
              />
            </Field>
          </div>

          <div className="rounded-lg border border-border bg-bg/60 p-4">
            <label htmlFor="m-pengurus" className="flex cursor-pointer items-start gap-3">
              <input
                id="m-pengurus"
                type="checkbox"
                checked={form.isPengurus}
                disabled={saving || !bolehPengurus}
                onChange={(e) => setForm((f) => ({ ...f, isPengurus: e.target.checked }))}
                className="mt-0.5 size-4 shrink-0 rounded border-control-border"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">Jadikan pengurus</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">
                  {locked
                    ? "Terkunci karena nomor anggota sudah terbit. Peserta tetap anggota biasa."
                    : bolehPengurus
                      ? "Aktif hanya untuk level Pusat, Wilayah, atau Daerah. Level lain tetap anggota biasa."
                      : "Pilih level Pusat, Wilayah, atau Daerah dulu untuk mengaktifkan."}
                </span>
              </span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" loading={saving} disabled={saving}>
              Simpan keanggotaan
            </Button>
            {!d.hasPassword && <span className="text-sm text-ink-muted">Anggota belum punya sandi.</span>}
          </div>
        </form>

        <div className="border-t border-border pt-6">
          <h3 className="text-sm font-semibold text-ink">Reset sandi anggota</h3>
          <p className="mt-1 text-sm text-ink-muted">Sandi dipakai anggota untuk masuk memakai NIK. Minimal 8 karakter.</p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1 space-y-1.5">
              <Label htmlFor="m-newpassword" className="block text-sm font-medium text-ink">
                Sandi baru
              </Label>
              <Input
                id="m-newpassword"
                type="password"
                autoComplete="new-password"
                required
                aria-invalid={pwError ? true : undefined}
                aria-describedby={pwError ? "m-newpassword-error" : undefined}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setPwError(undefined);
                }}
              />
              {pwError && (
                <p id="m-newpassword-error" role="alert" className="text-sm font-medium text-danger">
                  {pwError}
                </p>
              )}
            </div>
            <Button variant="secondary" onClick={resetPw} loading={saving} disabled={saving}>
              Reset sandi
            </Button>
          </div>
        </div>

        {d.eligible && (
          <p className="text-sm leading-relaxed text-ink-muted">
            <Link
              href={detailPath(id)}
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              {locked ? "Cetak ulang KTA" : "Cetak KTA"}
            </Link>{" "}
            — {locked ? "nomor tetap, kartu dicetak ulang." : "menerbitkan nomor anggota permanen."}
          </p>
        )}
      </div>
    </section>
  );
}

function Field({
  id,
  label,
  hint,
  required,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
        {required && (
          <span className="ml-0.5 text-primary" aria-hidden>
            *
          </span>
        )}
      </Label>
      {children}
      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}
