"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Markup kartu KTA final, dirender di atas artwork asli (depan & belakang)
 * memakai koordinat dari `lib/kta-layout.ts`, sumber yang sama dengan lab
 * koordinat. Jadi preview lab == hasil cetak.
 *
 * Geometri: `.kta-card { font-size: 85.6mm }` (lebar kartu). Semua ukuran slot
 * memakai `em`, jadi 1em = lebar kartu, dan hasilnya identik di layar & print.
 * Tidak memakai container query / cqw: beberapa renderer print menghitungnya 0.
 */

import { KTA_FACE_SRC, KTA_LAYOUT, boxStyle, fontStyle, type KtaBox } from "@/lib/kta-layout";
import { compactPersonName } from "@/lib/person-name";
import { displayMemberNumber } from "@/lib/member-number";
import { cn } from "@/lib/utils";

export type KtaCardData = {
  memberNumber: string;
  fullName: string;
  levelLabel: string;
  provinceName: string | null;
  regencyName: string | null;
  photoPath: string | null;
  issuedAt: string;
  verifyUrl: string;
  qrPng: string;
  pejabat: {
    ketuaUmum: { nama: string; jabatan: string };
    sekjen: { nama: string; jabatan: string };
  };
};

/** "Anggota | DKI Jakarta | Kabupaten Cianjur", level | wilayah | daerah. */
function levelWilayah(d: KtaCardData): string {
  return [d.levelLabel, d.provinceName, d.regencyName].filter(Boolean).join(" | ");
}

function photoSrc(p: string): string {
  return p.startsWith("/") ? p : `/${p}`;
}

/**
 * Slot pas foto di kartu. Kalau berkasnya hilang di storage (path tercatat di DB
 * tapi file tidak ada), seluruh slot tidak digambar, bukan kotak putih kosong,
 * bukan ikon gambar rusak.
 */
function PhotoSlot({ box, photoPath, fullName }: { box: KtaBox; photoPath: string; fullName: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <div
      className="absolute overflow-hidden bg-white"
      style={{
        left: `${box.x}%`,
        top: `${box.y}%`,
        width: `${box.w}%`,
        aspectRatio: "13 / 17",
        borderRadius: "0.7mm",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photoSrc(photoPath)}
        alt={`Pas foto ${fullName}`}
        className="size-full object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

/**
 * Blok absolute; `align: center` membuat x = titik tengah blok.
 * Wrapper memegang posisi + lebar (em dari font-size kartu). Font-size di
 * elemen anak, supaya `em` pada width tidak menyusut mengikuti teks.
 */
function Slot({
  box,
  children,
  className,
}: {
  box: KtaBox;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div style={{ position: "absolute", ...boxStyle(box) }} className={className}>
      <div style={fontStyle(box)}>{children}</div>
    </div>
  );
}

/** Lebar kartu dalam px CSS: 85,6 mm pada 96 dpi. */
const CARD_PX = (85.6 / 25.4) * 96;

export function KtaCardView({
  data,
  compact = false,
  wide = false,
}: {
  data: KtaCardData;
  /** Pratinjau kecil untuk dashboard. */
  compact?: boolean;
  /** Pratinjau selebar kontainer (halaman kartu). */
  wide?: boolean;
}) {
  const d = data;
  const [flipped, setFlipped] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // `zoom` tidak menerima calc()/panjang, jadi skala dihitung dari lebar
  // kontainer. Cap 4.4× mencegah pratinjau raksasa di layar ultra-wide.
  useEffect(() => {
    if (!wide) return;
    const el = stageRef.current;
    if (!el || typeof ResizeObserver !== "function") return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w > 0) setZoom(Math.min(4.4, Math.max(0.8, w / CARD_PX)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [wide]);
  const L = KTA_LAYOUT;
  const align = (b: KtaBox) => (b.align === "center" ? "text-center" : "text-left");
  const kosong = (b: KtaBox) => b.size === 0;

  return (
    <div ref={stageRef} className="kta-print-stage flex flex-col items-center gap-3">
      {/* Flip: dua sisi menempati ruang yang sama, diputar 180° lewat CSS.
          Kartu sendiri yang jadi tombol, tap = balik. `kta-flip` hanya
          berlaku di layar; saat print kedua sisi dicetak berurutan. */}
      <div
        className={cn("kta-flip", flipped && "is-flipped", compact && "kta-flip-compact")}
        style={wide && zoom ? { zoom } : undefined}
        role="button"
        tabIndex={0}
        aria-pressed={flipped}
        aria-label={flipped ? "Preview sisi belakang. Tekan untuk balik ke depan." : "Preview sisi depan. Tekan untuk balik kartu."}
        onClick={() => setFlipped((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setFlipped((v) => !v);
          }
        }}
      >
      <div className="kta-flip-inner">
      {/* ---------- DEPAN ---------- */}
      <article
        className="kta-card kta-flip-face kta-flip-front font-kta"
        aria-label={`Kartu tanda anggota ${d.fullName}, sisi depan`}
        data-face="depan"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={KTA_FACE_SRC.depan} alt="" className="absolute inset-0 size-full object-cover" />

        {/* Pas foto, kosong atau berkas hilang = slot tidak digambar */}
        {d.photoPath && <PhotoSlot box={L.photo} photoPath={d.photoPath} fullName={d.fullName} />}

        {/* Nama */}
        {!kosong(L.fullName) && (
          <Slot box={L.fullName} className={`text-white ${align(L.fullName)}`}>
            <p className="truncate font-extrabold leading-tight">{compactPersonName(d.fullName)}</p>
          </Slot>
        )}

        {/* Level · wilayah */}
        {!kosong(L.levelLabel) && (
          <Slot box={L.levelLabel} className={`text-white/90 ${align(L.levelLabel)}`}>
            <p className="truncate leading-tight">{levelWilayah(d)}</p>
          </Slot>
        )}

        {/* Nomor KTA, paling tebal yang ada di font (800) */}
        {!kosong(L.memberNumber) && (
          <Slot box={L.memberNumber} className={`text-white ${align(L.memberNumber)}`}>
            <p className="truncate font-medium leading-none tracking-wider">{displayMemberNumber(d.memberNumber)}</p>
          </Slot>
        )}

        {/* Satu QR: scan = halaman verifikasi berisi detail kartu. */}
        {/* QR tidak memakai font, jadi size 0 itu normal, jangan pakai kosong(). */}
        <QrSlot
          box={L.qrVerifikasi}
          src={d.qrPng}
          url={d.verifyUrl}
          label={`QR verifikasi ${d.fullName}`}
        />
      </article>

      {/* ---------- BELAKANG ---------- */}
      {/* Sisi belakang = artwork apa adanya. Jangan tambah teks overlay di sini. */}
      <article
        className="kta-card kta-flip-face kta-flip-back"
        aria-label={`Kartu tanda anggota ${d.fullName}, sisi belakang`}
        data-face="belakang"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={KTA_FACE_SRC.belakang} alt="" className="absolute inset-0 size-full object-cover" />
      </article>
      </div>
      </div>
      <p className="kta-flip-hint no-print text-center text-sm text-ink-muted">Tap kartu untuk membalik preview.</p>
    </div>
  );
}

/** Radius sudut kotak QR. QR 8,5mm → 1mm ≈ 12% (membulat halus, tidak jadi lingkaran). */
const QR_RADIUS = "1mm";
/**
 * Quiet zone tambahan di dalam kotak QR. Gambar QR sudah punya margin sendiri
 * dari generator, tapi tepi artwork kartu bisa memotongnya, padding ini
 * memastikan modul paling luar tetap terbaca pemindai.
 */
const QR_PADDING = "6%";

function QrSlot({ box, src, url, label }: { box: KtaBox; src: string; url: string; label: string }) {
  return (
    <div style={{ position: "absolute", ...boxStyle(box), aspectRatio: "1 / 1" }}>
      {src ? (
        <a
          href={url || undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          className="block size-full"
        >
          {/* QR: latar putih + sudut membulat supaya modul tetap kontras di atas artwork. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={label}
            className="size-full bg-white object-contain"
            style={{ borderRadius: QR_RADIUS, padding: QR_PADDING }}
          />
        </a>
      ) : (
        <div
          className="grid size-full place-items-center border border-dashed border-white/40 text-center leading-tight text-white/50"
          style={{ fontSize: "0.012em" }}
        >
          QR
        </div>
      )}
    </div>
  );
}

