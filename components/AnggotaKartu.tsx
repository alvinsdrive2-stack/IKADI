"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, Printer, Upload } from "lucide-react";
import { Alert } from "@/components/Alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KtaStepper } from "@/components/ui/stepper";
import { KtaCardView } from "@/components/KtaCardView";
import { formatDate } from "@/components/constants";
import { PHOTO_MAX_BYTES } from "@/lib/schema";

type Kta = {
  verifyUrl: string;
  qrPng: string;
  pejabat?: { ketuaUmum: { nama: string; jabatan: string }; sekjen: { nama: string; jabatan: string } };
};
type Profile = {
  fullName: string;
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

/** Rasio kotak pas foto di kartu (lihat KtaCardView: `aspectRatio: "13 / 17"`). */
const PHOTO_RATIO = 13 / 17;
const PHOTO_MAX_SIDE = 900;

/**
 * Potong tengah ke rasio 13:17 lalu perkecil sebelum dikirim.
 * Tujuannya persis kasus yang bikin foto "kepotong": pemotongan dilakukan
 * di sini, terlihat jelas, bukan tiba-tiba di kartu.
 */
async function cropToCardPhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const { width: sw, height: sh } = bitmap;
  const target = PHOTO_RATIO;
  let cw = sw;
  let ch = Math.round(sw / target);
  if (ch > sh) {
    ch = sh;
    cw = Math.round(sh * target);
  }
  const sx = Math.round((sw - cw) / 2);
  const sy = Math.round((sh - ch) / 2);
  const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(cw, ch));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(cw * scale);
  canvas.height = Math.round(ch * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("CANVAS");
  }
  ctx.drawImage(bitmap, sx, sy, cw, ch, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.9);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("READ"));
    reader.readAsDataURL(file);
  });
}

/**
 * Unggah / ganti pas foto. Muncul sebagai ajakan saat foto belum ada, dan
 * sebagai tombol "Ganti foto" saat sudah ada, supaya anggota bisa
 * memperbaiki foto yang terpotong tanpa menghubungi admin.
 */
function PhotoUploader({
  hasPhoto,
  photoPath,
  fullName,
  onSaved,
}: {
  hasPhoto: boolean;
  photoPath: string | null;
  fullName: string;
  onSaved: (photoPath: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setError("Format foto harus JPEG, PNG, atau WebP.");
      return;
    }
    setBusy(true);
    try {
      const cropped = await cropToCardPhoto(file).catch(() => readAsDataUrl(file));
      if (cropped.length * 0.75 > PHOTO_MAX_BYTES) {
        setError("Foto masih terlalu besar setelah dipotong. Coba foto lain.");
        return;
      }
      const res = await fetch("/api/anggota/foto", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo: cropped }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.errors?.photo ?? body?.message ?? "Foto gagal disimpan. Coba lagi.");
        return;
      }
      setPreview(cropped);
      onSaved(body.data.photoPath);
    } catch {
      setError("Foto gagal diproses. Coba lagi.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const currentSrc = preview ?? (photoPath ? (photoPath.startsWith("/") ? photoPath : `/${photoPath}`) : null);

  return (
    <section className="no-print rounded-xl border border-border bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">Pas foto kartu</h2>
          <p className="mt-1 text-sm text-ink-muted">
            {hasPhoto
              ? "Foto terpotong atau tidak pas? Unggah ulang, hasilnya bisa dilihat langsung di kartu."
              : "Kartu belum punya pas foto. Unggah sekarang supaya saat dicetak tidak kosong."}
          </p>
        </div>
        {!hasPhoto && <Badge variant="pd">Belum ada</Badge>}
      </div>
      <div className="flex flex-wrap items-center gap-4 p-5">
        <div
          className="shrink-0 overflow-hidden rounded-lg border border-border bg-bg"
          style={{ width: "6.5rem", aspectRatio: "13 / 17" }}
        >
          {currentSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentSrc} alt={`Pas foto ${fullName}`} className="size-full object-cover" />
          ) : (
            <div className="grid size-full place-items-center text-center text-xs text-ink-muted">
              Belum ada foto
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="user"
            className="sr-only"
            id="anggota-photo-input"
            onChange={(e) => void pick(e.target.files?.[0])}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={hasPhoto ? "outline" : "default"}
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {hasPhoto ? <Camera aria-hidden /> : <Upload aria-hidden />}
              {busy ? "Menyimpan…" : hasPhoto ? "Ganti foto" : "Unggah foto"}
            </Button>
          </div>
          <p className="text-xs text-ink-muted">
            JPEG/PNG/WebP, maks 1 MB. Foto dipotong otomatis ke rasio kartu (13:17) dari bagian tengah.
          </p>
          {error && <p className="text-xs font-medium text-danger">{error}</p>}
        </div>
      </div>
    </section>
  );
}

export function AnggotaKartu() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  /** Foto hasil unggahan terbaru, dipakai langsung tanpa menunggu refetch. */
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoVersion, setPhotoVersion] = useState(0);

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
  // Foto terbaru menang atas data awal; `?v=` mencegah browser memakai cache URL yang sama.
  const aktifPhoto = photoPath ?? p.photoPath;
  const withVersion = (path: string | null) =>
    path && photoVersion > 0 ? `${path}${path.includes("?") ? "&" : "?"}v=${photoVersion}` : path;

  const placeholder = {
    memberNumber: "-",
    fullName: p.fullName,
    levelLabel: p.levelLabel,
    provinceName: p.province,
    regencyName: p.city,
    photoPath: withVersion(aktifPhoto),
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
            <KtaStepper steps={STEPS} current={1} />
            <Alert tone="info">
              <span className="font-semibold">Nomor anggota belum terbit.</span> Nomor akan terbit saat kartu dicetak
              admin. Setelah itu kartu di sini otomatis memuat nomor dan QR verifikasi.
            </Alert>
          </div>
        </section>

        <PhotoUploader
          hasPhoto={!!aktifPhoto}
          photoPath={withVersion(aktifPhoto)}
          fullName={p.fullName}
          onSaved={(path) => {
            setPhotoPath(path);
            setPhotoVersion((v) => v + 1);
          }}
        />

        <div className="kta-print-reset flex justify-center rounded-xl border border-border bg-bg p-4 sm:p-6">
          <KtaCardView wide data={placeholder} />
        </div>
      </div>
    );
  }

  const data = {
    memberNumber: p.memberNumber ?? "-",
    fullName: p.fullName,
    levelLabel: p.levelLabel,
    provinceName: p.province,
    regencyName: p.city,
    photoPath: withVersion(aktifPhoto),
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
          <KtaStepper steps={STEPS} current={2} />
        </section>
      </div>

      <div className="kta-print-reset flex justify-center rounded-xl border border-border bg-bg p-4 sm:p-6">
        <KtaCardView wide data={data} />
      </div>

      <PhotoUploader
        hasPhoto={!!aktifPhoto}
        photoPath={withVersion(aktifPhoto)}
        fullName={p.fullName}
        onSaved={(path) => {
          setPhotoPath(path);
          setPhotoVersion((v) => v + 1);
        }}
      />

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
