"use client";

import { useState } from "react";
import Image from "next/image";
import { BadgeCheck, QrCode, Shield, CheckCircle2, RotateCw } from "lucide-react";

export function KtaPreviewCard() {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div className="relative mx-auto w-full max-w-[480px]">
      {/* Ambient background glow & ornamentation */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-4 rounded-3xl bg-gradient-to-br from-ikadi-lime/20 via-primary/20 to-accent/20 blur-2xl"
      />

      {/* Decorative floating badge 1 */}
      <div className="hidden sm:flex absolute -top-5 -left-4 z-20 items-center gap-2 rounded-full border border-white/20 bg-surface/90 px-3.5 py-1.5 shadow-raised backdrop-blur-md">
        <BadgeCheck className="size-4 text-primary" strokeWidth={2.5} />
        <span className="text-xs font-bold text-ink">Standar Resmi PP IKADI</span>
      </div>

      {/* Decorative floating badge 2 */}
      <div className="hidden sm:flex absolute -bottom-4 -right-3 z-20 items-center gap-2 rounded-full border border-white/20 bg-surface/90 px-3.5 py-1.5 shadow-raised backdrop-blur-md">
        <Shield className="size-4 text-primary" strokeWidth={2} />
        <span className="text-xs font-bold text-ink">QR Verifikasi Publik</span>
      </div>

      {/* Card Container */}
      <div className="relative perspective-[1000px]">
        <div
          className={`relative aspect-[1.586/1] w-full transition-transform duration-700 [transform-style:preserve-3d] ${
            isFlipped ? "[transform:rotateY(180deg)]" : ""
          }`}
        >
          {/* SISI DEPAN (FRONT) */}
          <div className="absolute inset-0 overflow-hidden rounded-2xl border border-white/30 bg-kta-front p-4 sm:p-5 text-white shadow-2xl [backface-visibility:hidden]">
            {/* Official Single Background — No tiles, no repeat */}
            <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
              <Image
                src="/ornaments/aset_background_2_kanan_atas_1080p.png"
                alt=""
                fill
                sizes="(max-width: 640px) 100vw, 480px"
                className="object-cover object-center opacity-85"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-kta-front-ink/85 via-transparent to-kta-front-ink/60" />
            </div>

            {/* Header KTA */}
            <div className="relative z-10 flex items-center justify-between gap-2 border-b border-white/25 pb-2.5">
              <div className="flex items-center gap-2">
                <Image
                  src="/logo.png"
                  alt="Logo IKADI"
                  width={28}
                  height={28}
                  className="size-7 sm:size-8 shrink-0 object-contain drop-shadow"
                />
                <div>
                  <p className="text-[10px] sm:text-xs font-black tracking-wider uppercase">IKADI</p>
                  <p className="text-[8px] sm:text-[9px] font-medium leading-none text-white/90">
                    Ikatan Da&apos;i Indonesia
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-accent">
                  Kartu Tanda Anggota
                </p>
                <p className="font-mono text-[10px] sm:text-xs font-bold tracking-wider text-white">
                  6.16.01.26.0001
                </p>
              </div>
            </div>

            {/* Body Info */}
            <div className="relative z-10 mt-3 flex items-start gap-3 sm:gap-4">
              {/* Pas foto with gold frame */}
              <div className="relative shrink-0">
                <div className="relative h-[72px] w-[54px] sm:h-[86px] sm:w-[64px] overflow-hidden rounded-md border-2 border-accent bg-emerald-950/40 shadow-inner">
                  <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-b from-emerald-800/60 to-emerald-950/80 text-center">
                    <div className="size-7 sm:size-8 rounded-full border border-white/30 bg-white/20 flex items-center justify-center text-xs font-bold">
                      DAI
                    </div>
                    <span className="mt-1 text-[7px] text-white/70">Foto Anggota</span>
                  </div>
                </div>
                {/* Chip smartcard simulation */}
                <div
                  aria-hidden
                  className="absolute -bottom-1 -right-1 size-4 rounded-sm border border-amber-300 bg-gradient-to-br from-amber-200 to-amber-500 shadow-sm"
                  title="Smartcard Chip"
                />
              </div>

              {/* Data Anggota */}
              <div className="min-w-0 flex-1 leading-snug">
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex size-2 rounded-full bg-accent animate-pulse" />
                  <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-emerald-100">
                    Status: Aktif Terverifikasi
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs sm:text-base font-extrabold text-white">
                  Ust. H. Ahmad Fauzi, Lc., M.A.
                </p>
                <p className="text-[9px] sm:text-[11px] font-semibold text-emerald-100">
                  Pengurus Daerah Kota Surabaya
                </p>
                <p className="text-[8px] sm:text-[9px] text-white/80">
                  PW Jawa Timur · Tingkat Da&apos;i Daerah
                </p>

                <div className="mt-2 flex items-center gap-2">
                  <span className="rounded-[4px] bg-white/15 px-1.5 py-0.5 font-mono text-[8px] sm:text-[9px] font-bold text-white">
                    Registrasi: 2026
                  </span>
                  <span className="rounded-[4px] bg-accent/20 px-1.5 py-0.5 text-[8px] sm:text-[9px] font-bold text-accent">
                    KTA Digital & Fisik
                  </span>
                </div>
              </div>
            </div>

            {/* Footer Signatures & QR */}
            <div className="absolute inset-x-0 bottom-2.5 sm:bottom-3 z-10 flex items-end justify-between px-4 sm:px-5">
              <div className="text-[7px] sm:text-[8px] leading-tight text-white/90">
                <p className="text-[6px] sm:text-[7px] uppercase tracking-wider text-emerald-200">Ketua Umum PP IKADI</p>
                <p className="font-bold">Dr. KH. Ahmad Kusyairi, MA</p>
              </div>

              {/* QR Code Container */}
              <div className="flex items-center gap-1.5 rounded-lg border border-white/30 bg-white/95 p-1 text-ink shadow">
                <QrCode className="size-6 sm:size-7 text-ink" />
                <div className="hidden sm:block text-[6.5px] font-bold uppercase leading-none text-ink-muted">
                  Pindai<br />Verifikasi
                </div>
              </div>

              <div className="text-right text-[7px] sm:text-[8px] leading-tight text-white/90">
                <p className="text-[6px] sm:text-[7px] uppercase tracking-wider text-emerald-200">Sekretaris Jenderal</p>
                <p className="font-bold">H. Khairuddin, S.Ag</p>
              </div>
            </div>
          </div>

          {/* SISI BELAKANG (BACK) */}
          <div className="absolute inset-0 overflow-hidden rounded-2xl border border-white/30 bg-kta-back p-4 sm:p-5 text-white shadow-2xl [backface-visibility:hidden] [transform:rotateY(180deg)]">
            {/* Official Single Background — No tiles, no repeat */}
            <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
              <Image
                src="/ornaments/aset_background_4_kanan_bawah_1080p.png"
                alt=""
                fill
                sizes="(max-width: 640px) 100vw, 480px"
                className="object-cover object-center opacity-70"
              />
              <div className="absolute inset-0 bg-kta-back-ink/80" />
            </div>
            
            <div className="relative z-10 flex items-center justify-between border-b border-white/20 pb-2">
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-accent">
                Ketentuan Penggunaan KTA
              </p>
              <Image
                src="/logo.png"
                alt="Logo IKADI"
                width={20}
                height={20}
                className="size-5 shrink-0 object-contain drop-shadow"
              />
            </div>

            <ol className="relative z-10 mt-2.5 space-y-1 sm:space-y-1.5 text-[8px] sm:text-[9.5px] leading-relaxed text-white/90 list-decimal list-inside">
              <li>Kartu ini adalah identitas resmi anggota Ikatan Da&apos;i Indonesia (IKADI).</li>
              <li>Keaslian kartu dapat diverifikasi secara publik melalui pemindaian kode QR di bagian depan.</li>
              <li>Pemegang kartu wajib menjunjung tinggi kode etik dakwah dan AD/ART IKADI.</li>
              <li>Bila kartu ini hilang atau ditemukan pihak lain, harap segera melaporkan ke sekretariat IKADI terdekat.</li>
            </ol>

            <div className="absolute inset-x-4 sm:inset-x-5 bottom-3 z-10 flex items-center justify-between border-t border-white/20 pt-2 text-[7px] sm:text-[8px] text-emerald-200">
              <p>Sekretariat Pengurus Pusat IKADI</p>
              <p>Portal Layanan: www.ikadi.or.id</p>
            </div>
          </div>
        </div>

        {/* Flip interactive control */}
        <div className="mt-3 flex items-center justify-between px-1 text-xs text-white/90">
          <span className="flex items-center gap-1.5 text-xs text-white/80">
            <CheckCircle2 className="size-3.5 text-accent" />
            <span>Format Kartu Fisik & Digital ID-1</span>
          </span>
          <button
            type="button"
            onClick={() => setIsFlipped(!isFlipped)}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold text-white transition-all hover:bg-white/20 hover:border-white/50"
          >
            <RotateCw className="size-3" />
            <span>{isFlipped ? "Lihat Sisi Depan" : "Lihat Sisi Belakang"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
