"use client";

import { useEffect, useRef, useState } from "react";
import { SwitchCamera, Images, X, ScanLine, LoaderCircle, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Custom camera KTP — getUserMedia + crop frame 1.586:1, canvas capture.
 * Fallback: input capture="environment" kalau getUserMedia ditolak / desktop.
 * File hasil: JPEG File yang siap masuk pipeline onKtpChange (OCR + validasi).
 */
export function CustomCamera({
  mode,
  onPick,
  onBack,
}: {
  mode: "foto" | "galeri";
  onPick: (file: File | undefined) => void;
  onBack: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [phase, setPhase] = useState<"starting" | "live" | "error">("starting");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [hasOIS, setHasOIS] = useState(false);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startStream = async (f: "environment" | "user") => {
    stopStream();
    setPhase("starting");
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: f },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setPhase("live");

      // deteksi torch / OIS best-effort untuk label hint
      try {
        const track = stream.getVideoTracks()[0] as MediaStreamTrack & { getCapabilities?: () => Record<string, unknown> };
        const caps = track.getCapabilities?.() ?? {};
        setHasOIS(Boolean((caps as Record<string, unknown>).torch));
      } catch {
        setHasOIS(false);
      }
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      setPhase("error");
      setErrorMsg(
        name === "NotAllowedError"
          ? "Izin kamera ditolak. Izinkan kamera di pengaturan browser, atau pilih dari galeri."
          : name === "NotFoundError" || name === "OverconstrainedError"
            ? "Kamera tidak ditemukan. Pilih dari galeri sebagai gantinya."
            : "Kamera tidak bisa dibuka. Pilih dari galeri sebagai gantinya."
      );
    }
  };

  useEffect(() => {
    if (mode === "galeri") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- startStream syncs camera hardware (external system)
    startStream(facing);
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, facing]);

  const capture = async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    setCapturing(true);
    try {
      // Crop ke frame 1.586:1 (rasio KTP fisik) — potong center
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const targetRatio = 1.586;
      let sw = vw;
      let sh = vh;
      if (vw / vh > targetRatio) {
        sw = Math.round(vh * targetRatio);
      } else {
        sh = Math.round(vw / targetRatio);
      }
      const sx = Math.round((vw - sw) / 2);
      const sy = Math.round((vh - sh) / 2);

      const canvas = document.createElement("canvas");
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
      if (!blob) throw new Error("blob");

      // Preview dulu sebelum kirim — user bisa ulang kalau miring / silau
      const url = URL.createObjectURL(blob);
      setPreview(url);
    } catch {
      setErrorMsg("Gagal mengambil foto. Coba lagi.");
    } finally {
      setCapturing(false);
    }
  };

  const confirmPreview = () => {
    if (!preview) return;
    fetch(preview)
      .then((r) => r.blob())
      .then((blob) => {
        const file = new File([blob], `ktp-${Date.now()}.jpg`, { type: "image/jpeg" });
        onPick(file);
      })
      .catch(() => setErrorMsg("Gagal memproses foto. Coba lagi."));
  };

  const toggleFacing = () => setFacing((f) => (f === "environment" ? "user" : "environment"));

  return (
    <section
      className="flex flex-1 flex-col bg-cam text-white md:mx-auto md:max-w-md md:rounded-[4px] md:border md:border-cam-edge"
      aria-label={mode === "foto" ? "Ambil foto KTP dengan kamera" : "Pilih foto KTP dari galeri"}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4">
        <span className="inline-flex items-center gap-2 text-sm font-semibold">
          <ScanLine aria-hidden className="size-4 text-accent" strokeWidth={2} />
          {mode === "foto" ? "Foto KTP" : "Pilih dari galeri"}
        </span>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-[4px] px-3 text-sm font-medium text-white/85 hover:bg-white/10"
        >
          <X aria-hidden className="size-4" /> Batal
        </button>
      </div>

      {/* Viewfinder */}
      <div className="relative mx-4 mt-3 aspect-[1.586/1] overflow-hidden rounded-[4px] border border-cam-edge bg-black">
        {phase === "live" && !preview && (
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="absolute inset-0 h-full w-full object-cover"
            aria-label="Pratinjau kamera"
          />
        )}
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Hasil foto KTP" className="absolute inset-0 h-full w-full object-cover" />
        ) : phase === "starting" ? (
          <div className="absolute inset-0 grid place-items-center text-sm text-cam-ink">
            <span className="inline-flex items-center gap-2"><LoaderCircle aria-hidden className="size-4 animate-spin" /> Membuka kamera…</span>
          </div>
        ) : phase === "error" ? (
          <div className="absolute inset-0 grid place-items-center px-6 text-center">
            <div>
              <TriangleAlert aria-hidden className="mx-auto size-8 text-accent" strokeWidth={2} />
              <p className="mt-3 text-sm leading-relaxed text-white/85">{errorMsg}</p>
            </div>
          </div>
        ) : null}

        {/* Frame KTP — kotak tajam, sudut emas (bukan rounded) */}
        {!preview && phase !== "error" && (
          <>
            <div aria-hidden className="absolute inset-3 rounded-[2px] border border-white/35" />
            <div aria-hidden className="absolute left-2 top-2 size-7 border-l-[3px] border-t-[3px] border-accent" />
            <div aria-hidden className="absolute right-2 top-2 size-7 border-r-[3px] border-t-[3px] border-accent" />
            <div aria-hidden className="absolute bottom-2 left-2 size-7 border-b-[3px] border-l-[3px] border-accent" />
            <div aria-hidden className="absolute bottom-2 right-2 size-7 border-b-[3px] border-r-[3px] border-accent" />
            <p className="absolute inset-x-3 bottom-3 text-center text-xs font-medium text-white/90">
              Posisikan KTP memenuhi bingkai
            </p>
          </>
        )}
      </div>

      <p className="px-4 pt-3 text-center text-xs leading-relaxed text-cam-ink">
        {mode === "foto"
          ? "Pastikan seluruh KTP terlihat, tidak terpotong, dan tidak silau. Foto yang diambil akan dibaca otomatis."
          : "Pilih foto KTP dari galeri. Foto akan dibaca otomatis setelah dipilih."}
        {hasOIS && " Perangkat mendukung stabilisasi gambar."}
      </p>

      {errorMsg && phase === "live" && (
        <p role="alert" className="mx-4 mt-3 rounded-[4px] border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent">
          {errorMsg}
        </p>
      )}

      {/* Aksi */}
      {preview ? (
        <div className="mt-auto flex gap-3 px-4 pb-5 pt-4">
          <Button variant="outline" className="flex-none border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={() => setPreview(null)}>
            Ulangi
          </Button>
          <Button className="flex-1" onClick={confirmPreview}>
            Pakai foto ini
          </Button>
        </div>
      ) : (
        <div className="mt-auto space-y-3 px-4 pb-5 pt-4">
          {mode === "foto" && phase === "live" && (
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={toggleFacing}
                aria-label={facing === "environment" ? "Ganti ke kamera depan" : "Ganti ke kamera belakang"}
                className="grid size-11 place-items-center rounded-[4px] border border-cam-edge text-white/85 hover:bg-white/10"
              >
                <SwitchCamera aria-hidden className="size-5" strokeWidth={2} />
              </button>

              <button
                type="button"
                onClick={capture}
                disabled={capturing}
                aria-label="Ambil foto"
                className={cn(
                  "grid size-16 place-items-center rounded-full border-[5px] border-cam-edge bg-surface transition-transform active:scale-95 disabled:opacity-60",
                  capturing && "animate-pulse"
                )}
              >
                <span className="size-11 rounded-full bg-primary" aria-hidden />
              </button>

              <label
                aria-label="Pilih dari galeri"
                className="grid size-11 cursor-pointer place-items-center rounded-[4px] border border-cam-edge text-white/85 hover:bg-white/10"
              >
                <Images aria-hidden className="size-5" strokeWidth={2} />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => onPick(e.target.files?.[0])}
                  className="sr-only"
                />
              </label>
            </div>
          )}

          {mode === "galeri" && (
            <label className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-[4px] border border-cam-edge bg-surface px-5 text-base font-semibold text-primary hover:bg-primary-soft">
              <Images aria-hidden className="size-5" strokeWidth={2} />
              Pilih foto dari galeri
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => onPick(e.target.files?.[0])}
                className="sr-only"
              />
            </label>
          )}

          {mode === "foto" && phase === "error" && (
            <label className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-[4px] border border-cam-edge bg-surface px-5 text-base font-semibold text-primary hover:bg-primary-soft">
              <Images aria-hidden className="size-5" strokeWidth={2} />
              Pilih dari galeri sebagai gantinya
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => onPick(e.target.files?.[0])}
                className="sr-only"
              />
            </label>
          )}

          <p className="text-center text-[11px] text-cam-ink">
            {facing === "environment" ? "Kamera belakang" : "Kamera depan"} · Ketuk tombol bulat untuk memotret
          </p>
        </div>
      )}
    </section>
  );
}
