"use client";

/**
 * Markup kartu KTA final — dirender di atas artwork asli (depan & belakang)
 * memakai koordinat dari `lib/kta-layout.ts`, sumber yang sama dengan lab
 * koordinat. Jadi preview lab == hasil cetak.
 *
 * Geometri: `.kta-card { font-size: 85.6mm }` (lebar kartu). Semua ukuran slot
 * memakai `em`, jadi 1em = lebar kartu, dan hasilnya identik di layar & print.
 * Tidak memakai container query / cqw: beberapa renderer print menghitungnya 0.
 */

import { KTA_FACE_SRC, KTA_LAYOUT, KTA_NOTE_DEFAULT, boxStyle, fontStyle, type KtaBox } from "@/lib/kta-layout";
import { compactPersonName } from "@/lib/person-name";

export type KtaCardData = {
  memberNumber: string;
  fullName: string;
  originType: string;
  originName: string;
  levelLabel: string;
  provinceName: string | null;
  regencyName: string | null;
  photoPath: string | null;
  issuedAt: string;
  verifyUrl: string;
  qrPng: string;
  /** Teks bebas di bawah QR otentikasi. Kosong = pakai KTA_NOTE_DEFAULT. */
  note?: string | null;
  pejabat: {
    ketuaUmum: { nama: string; jabatan: string };
    sekjen: { nama: string; jabatan: string };
  };
};

/** "Anggota | Jawa Barat | Kabupaten Cianjur" — level | wilayah | daerah. */
function levelWilayah(d: KtaCardData): string {
  return [d.levelLabel, d.provinceName, d.regencyName].filter(Boolean).join(" | ");
}

function photoSrc(p: string): string {
  return p.startsWith("/") ? p : `/${p}`;
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

export function KtaCardView({ data }: { data: KtaCardData }) {
  const d = data;
  const L = KTA_LAYOUT;
  const align = (b: KtaBox) => (b.align === "center" ? "text-center" : "text-left");
  const kosong = (b: KtaBox) => b.size === 0;

  return (
    <div className="kta-print-stage flex flex-col items-center gap-4">
      {/* ---------- DEPAN ---------- */}
      <article
        className="kta-card"
        aria-label={`Kartu tanda anggota ${d.fullName} — sisi depan`}
        data-face="depan"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={KTA_FACE_SRC.depan} alt="" className="absolute inset-0 size-full object-cover" />

        {/* Pas foto */}
        <div
          className="absolute overflow-hidden bg-white"
          style={{
            left: `${L.photo.x}%`,
            top: `${L.photo.y}%`,
            width: `${L.photo.w}%`,
            aspectRatio: "13 / 17",
          }}
        >
          {d.photoPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoSrc(d.photoPath)} alt={`Pas foto ${d.fullName}`} className="size-full object-cover" />
          ) : (
            <div
              className="grid size-full place-items-center bg-primary-soft text-center leading-tight text-primary-ink"
              style={{ fontSize: "0.016em" }}
            >
              Pas foto
            </div>
          )}
        </div>

        {/* Nama */}
        {!kosong(L.fullName) && (
          <Slot box={L.fullName} className={`text-white ${align(L.fullName)}`}>
            <p className="truncate font-bold leading-tight">{compactPersonName(d.fullName)}</p>
          </Slot>
        )}

        {/* Level · wilayah */}
        {!kosong(L.levelLabel) && (
          <Slot box={L.levelLabel} className={`text-white/90 ${align(L.levelLabel)}`}>
            <p className="truncate leading-tight">{levelWilayah(d)}</p>
          </Slot>
        )}

        {/* Nomor KTA — paling tebal yang ada di font (800) */}
        {!kosong(L.memberNumber) && (
          <Slot box={L.memberNumber} className={`text-white ${align(L.memberNumber)}`}>
            <p className="truncate font-mono font-extrabold leading-none tracking-wider">{d.memberNumber}</p>
          </Slot>
        )}

        {/* Dua QR di blok tanda tangan (QR otentikasi terpisah sudah dihapus). */}

        {/* Teks bebas di blok bawah kartu */}
        {!kosong(L.noteAuth) && (
          <Slot box={L.noteAuth} className={`text-white/85 ${align(L.noteAuth)}`}>
            <p className="leading-tight">{d.note?.trim() || KTA_NOTE_DEFAULT}</p>
          </Slot>
        )}
        <QrSlot
          box={L.qrKetum}
          src={d.qrPng}
          url={d.verifyUrl}
          label={`QR verifikasi ${d.pejabat.ketuaUmum.jabatan}`}
        />
        <QrSlot
          box={L.qrSekjen}
          src={d.qrPng}
          url={d.verifyUrl}
          label={`QR verifikasi ${d.pejabat.sekjen.jabatan}`}
        />

        <SignatureSlot box={L.ketum} jabatan={d.pejabat.ketuaUmum.jabatan} nama={d.pejabat.ketuaUmum.nama} />
        <SignatureSlot box={L.sekjen} jabatan={d.pejabat.sekjen.jabatan} nama={d.pejabat.sekjen.nama} />
      </article>

      {/* ---------- BELAKANG ---------- */}
      {/* Sisi belakang = artwork apa adanya. Jangan tambah teks overlay di sini. */}
      <article
        className="kta-card"
        aria-label={`Kartu tanda anggota ${d.fullName} — sisi belakang`}
        data-face="belakang"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={KTA_FACE_SRC.belakang} alt="" className="absolute inset-0 size-full object-cover" />
      </article>
    </div>
  );
}

/** Radius sudut kotak QR. QR 8,5mm → 1mm ≈ 12% (membulat halus, tidak jadi lingkaran). */
const QR_RADIUS = "1mm";

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
            style={{ borderRadius: QR_RADIUS }}
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

function SignatureSlot({ box, jabatan, nama }: { box: KtaBox; jabatan: string; nama: string }) {
  return (
    <Slot box={box} className={`text-white ${box.align === "center" ? "text-center" : "text-left"}`}>
      <p className="uppercase leading-tight tracking-wider text-white/80" style={{ fontSize: "80%" }}>
        {jabatan}
      </p>
      <p className="font-semibold leading-tight" style={{ fontSize: "100%" }}>
        {nama}
      </p>
    </Slot>
  );
}
