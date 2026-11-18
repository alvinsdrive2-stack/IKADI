"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Flashlight, Images, LoaderCircle, ScanLine, SwitchCamera, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Custom camera KTP, getUserMedia + crop frame 1.586:1, canvas capture.
 * Fallback: pilih dari galeri kalau getUserMedia ditolak / tidak tersedia / desktop.
 * File hasil: JPEG File yang siap masuk pipeline onKtpChange (OCR + validasi).
 */

type Facing = "environment" | "user";
type Phase = "starting" | "live" | "error";

// `torch` belum ada di lib.dom untuk semua target TS, dibaca lewat cast terisolasi di sini.
type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };
type TorchConstraint = MediaTrackConstraintSet & { torch?: boolean };

function hasTorch(track: MediaStreamTrack | undefined): boolean {
  const caps = track?.getCapabilities?.() as unknown as TorchCapabilities | undefined;
  return Boolean(caps?.torch);
}

const KTP_RATIO = 1.586;
const JPEG_QUALITY = 0.92;
const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

function describeCameraError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Izin kamera ditolak. Izinkan kamera di pengaturan browser, atau pilih dari galeri.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "Kamera tidak ditemukan. Pilih dari galeri sebagai gantinya.";
    case "NotReadableError":
    case "TrackStartError":
      return "Kamera sedang dipakai aplikasi lain. Tutup aplikasi tersebut, atau pilih dari galeri.";
    case "AbortError":
      return "Kamera gagal dibuka. Coba lagi, atau pilih dari galeri.";
    default:
      return "Kamera tidak bisa dibuka. Pilih dari galeri sebagai gantinya.";
  }
}

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
  const blobRef = useRef<Blob | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  // Setiap percobaan buka kamera dapat nomor; hasil yang nomornya sudah basi dibuang
  // supaya toggle kamera cepat tidak menumpuk dua stream.
  const attemptRef = useRef(0);

  const [facing, setFacing] = useState<Facing>("environment");
  const [phase, setPhase] = useState<Phase>("starting");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  const releaseStream = useCallback(() => {
    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const clearPreview = useCallback(() => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    blobRef.current = null;
    setPreviewUrl(null);
  }, []);

  // Buka ulang kamera setelah error: increment retryKey memaksa effect jalan lagi
  // walau facing/mode/previewUrl tidak berubah.
  const [retryKey, setRetryKey] = useState(0);
  const retry = () => setRetryKey((k) => k + 1);

  // Siklus hidup stream. Re-run saat facing berubah, saat foto diulang, dan saat
  // masuk/keluar pratinjau, kamera dimatikan selama pratinjau untuk hemat baterai.
  useEffect(() => {
    if (mode !== "foto" || previewUrl) return;

    const attempt = ++attemptRef.current;
    let cancelled = false;
    const isStale = () => cancelled || attempt !== attemptRef.current;

    void (async () => {
      // Reset status di dalam async: setState sinkron di badan effect memicu
      // cascading render dan dilarang react-hooks/set-state-in-effect.
      setPhase("starting");
      setErrorMsg(null);
      setTorchSupported(false);
      setTorchOn(false);

      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setPhase("error");
        setErrorMsg("Browser tidak mendukung kamera langsung. Pilih dari galeri sebagai gantinya.");
        return;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
      } catch (err) {
        if (isStale()) return;
        setPhase("error");
        setErrorMsg(describeCameraError(err));
        return;
      }

      if (isStale()) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        try {
          await video.play();
        } catch {
          if (isStale()) return;
          // Jangan lanjut ke fase live: video yang tidak jalan = viewfinder hitam.
          releaseStream();
          setPhase("error");
          setErrorMsg("Pratinjau kamera gagal dijalankan. Ketuk untuk mencoba lagi, atau pilih dari galeri.");
          return;
        }
      }
      if (isStale()) return;
      if (streamRef.current !== stream) return;

      setPhase("live");

      setTorchSupported(hasTorch(stream.getVideoTracks()[0]));
    })();

    return () => {
      cancelled = true;
      releaseStream();
    };
  }, [mode, facing, previewUrl, retryKey, releaseStream]);

  // Lepas object URL & track saat komponen dibongkar.
  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    []
  );

  const applyTorch = async (next: boolean) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as TorchConstraint] });
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
    }
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0) {
      setErrorMsg("Kamera belum siap. Tunggu sebentar lalu coba lagi.");
      return;
    }

    setCapturing(true);
    setErrorMsg(null);
    try {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      let sw = vw;
      let sh = vh;
      if (vw / vh > KTP_RATIO) {
        sw = Math.round(vh * KTP_RATIO);
      } else {
        sh = Math.round(vw / KTP_RATIO);
      }

      const canvas = document.createElement("canvas");
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("context");
      ctx.drawImage(video, Math.round((vw - sw) / 2), Math.round((vh - sh) / 2), sw, sh, 0, 0, sw, sh);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
      );
      if (!blob) throw new Error("blob");

      clearPreview();
      blobRef.current = blob;
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      setPreviewUrl(url); // memicu cleanup effect: stream dimatikan
    } catch {
      setErrorMsg("Gagal mengambil foto. Coba lagi.");
    } finally {
      setCapturing(false);
    }
  };

  const confirmPreview = () => {
    const blob = blobRef.current;
    if (!blob) {
      setErrorMsg("Foto tidak tersedia. Ulangi pengambilan.");
      return;
    }
    onPick(new File([blob], `ktp-${Date.now()}.jpg`, { type: "image/jpeg" }));
  };

  const toggleFacing = () => {
    setTorchOn(false);
    setFacing((f) => (f === "environment" ? "user" : "environment"));
  };

  // Input file yang sama dipilih dua kali tidak memicu onChange kalau value-nya
  // tidak direset dulu.
  const resetFileInput = (e: React.MouseEvent<HTMLInputElement>) => {
    e.currentTarget.value = "";
  };

  const galleryLabel = (text: string) => (
    <label className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-[4px] border border-cam-edge bg-surface px-5 text-base font-semibold text-primary hover:bg-primary-soft">
      <Images aria-hidden className="size-5" strokeWidth={2} />
      {text}
      <input
        type="file"
        accept={IMAGE_ACCEPT}
        onClick={resetFileInput}
        onChange={(e) => onPick(e.target.files?.[0])}
        className="sr-only"
      />
    </label>
  );

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
        {/* Video selalu ter-mount: kalau di-unmount, srcObject hilang dan pratinjau
            tidak bisa dipasang ulang tanpa membuka stream baru. */}
        {mode === "foto" && (
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            disablePictureInPicture
            className={cn("absolute inset-0 h-full w-full object-cover", previewUrl && "invisible")}
            aria-label="Pratinjau kamera"
          />
        )}

        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Hasil foto KTP" className="absolute inset-0 h-full w-full object-cover" />
        )}

        {!previewUrl && phase === "starting" && (
          <div role="status" className="absolute inset-0 grid place-items-center text-sm text-cam-ink">
            <span className="inline-flex items-center gap-2">
              <LoaderCircle aria-hidden className="size-4 animate-spin" /> Membuka kamera…
            </span>
          </div>
        )}

        {!previewUrl && phase === "error" && (
          <div className="absolute inset-0 grid place-items-center px-6 text-center">
            <div>
              <TriangleAlert aria-hidden className="mx-auto size-8 text-accent" strokeWidth={2} />
              <p className="mt-3 text-sm leading-relaxed text-white/85">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Bingkai KTP, tepi bingkai = area yang dipotong saat memotret */}
        {!previewUrl && phase !== "error" && (
          <>
            <div aria-hidden className="absolute inset-0 border border-white/25" />
            <div aria-hidden className="absolute left-2 top-2 size-7 border-l-[3px] border-t-[3px] border-accent" />
            <div aria-hidden className="absolute right-2 top-2 size-7 border-r-[3px] border-t-[3px] border-accent" />
            <div aria-hidden className="absolute bottom-2 left-2 size-7 border-b-[3px] border-l-[3px] border-accent" />
            <div aria-hidden className="absolute bottom-2 right-2 size-7 border-b-[3px] border-r-[3px] border-accent" />
            <p className="absolute inset-x-3 bottom-3 rounded-[2px] bg-black/45 px-2 py-1 text-center text-xs font-medium text-white/90">
              Posisikan KTP memenuhi bingkai
            </p>
          </>
        )}
      </div>

      <p className="px-4 pt-3 text-center text-xs leading-relaxed text-cam-ink">
        {mode === "foto"
          ? "Pastikan seluruh KTP terlihat, tidak terpotong, dan tidak silau. Foto yang diambil akan dibaca otomatis."
          : "Pilih foto KTP dari galeri. Foto akan dibaca otomatis setelah dipilih."}
      </p>

      {errorMsg && phase === "live" && (
        <p
          role="alert"
          className="mx-4 mt-3 rounded-[4px] border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent"
        >
          {errorMsg}
        </p>
      )}

      {/* Aksi */}
      {previewUrl ? (
        <div className="mt-auto flex gap-3 px-4 pb-5 pt-4">
          <Button
            variant="outline"
            className="flex-none border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
            onClick={clearPreview}
          >
            Ulangi
          </Button>
          <Button className="flex-1" onClick={confirmPreview}>
            Pakai foto ini
          </Button>
        </div>
      ) : (
        <div className="mt-auto space-y-3 px-4 pb-5 pt-4">
          {mode === "foto" && phase === "live" && (
            <>
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

                {torchSupported ? (
                  <button
                    type="button"
                    onClick={() => void applyTorch(!torchOn)}
                    aria-pressed={torchOn}
                    aria-label={torchOn ? "Matikan lampu" : "Nyalakan lampu"}
                    className={cn(
                      "grid size-11 place-items-center rounded-[4px] border border-cam-edge hover:bg-white/10",
                      torchOn ? "bg-accent/20 text-accent" : "text-white/85"
                    )}
                  >
                    <Flashlight aria-hidden className="size-5" strokeWidth={2} />
                  </button>
                ) : (
                  <label
                    aria-label="Pilih dari galeri"
                    className="grid size-11 cursor-pointer place-items-center rounded-[4px] border border-cam-edge text-white/85 hover:bg-white/10"
                  >
                    <Images aria-hidden className="size-5" strokeWidth={2} />
                    <input
                      type="file"
                      accept={IMAGE_ACCEPT}
                      onClick={resetFileInput}
                      onChange={(e) => onPick(e.target.files?.[0])}
                      className="sr-only"
                    />
                  </label>
                )}
              </div>

              {torchSupported && (
                <div className="flex justify-center">
                  <label
                    aria-label="Pilih dari galeri"
                    className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-[4px] px-3 text-xs font-medium text-cam-ink-strong hover:bg-white/10"
                  >
                    <Images aria-hidden className="size-4" strokeWidth={2} />
                    Pilih dari galeri
                    <input
                      type="file"
                      accept={IMAGE_ACCEPT}
                      onClick={resetFileInput}
                      onChange={(e) => onPick(e.target.files?.[0])}
                      className="sr-only"
                    />
                  </label>
                </div>
              )}
            </>
          )}

          {mode === "foto" && phase === "starting" && (
            <p className="text-center text-[11px] text-cam-ink">Menyiapkan kamera…</p>
          )}

          {mode === "galeri" && galleryLabel("Pilih foto dari galeri")}

          {mode === "foto" && phase === "error" && (
            <>
              <Button variant="outline" className="w-full border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={retry}>
                Coba buka kamera lagi
              </Button>
              {galleryLabel("Pilih dari galeri sebagai gantinya")}
            </>
          )}

          {mode === "foto" && phase === "live" && (
            <p className="text-center text-[11px] text-cam-ink">
              {facing === "environment" ? "Kamera belakang" : "Kamera depan"} · Ketuk tombol bulat untuk memotret
            </p>
          )}
        </div>
      )}
    </section>
  );
}
