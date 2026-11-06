"use client";

import { useState } from "react";
import Link from "next/link";
import { LogIn, Menu, X } from "lucide-react";
import { LogoMark } from "@/components/Logo";

const NAV = [
  { href: "/#alur", label: "Alur" },
  { href: "/#layanan", label: "Layanan" },
  { href: "/#kartu", label: "Kartu Anggota" },
  { href: "/#faq", label: "FAQ" },
];

const linkClass =
  "inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-medium text-ink-muted transition-colors hover:bg-primary-soft/50 hover:text-primary";

export function SiteHeader({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <header className={`sticky top-0 z-40 border-b border-border/80 bg-white/90 backdrop-blur-md ${className}`}>
      <div className="mx-auto flex h-20 max-w-[90rem] items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="IKADI — beranda" className="inline-flex items-center">
          <LogoMark priority size={120} />
        </Link>

        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Navigasi utama">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className={linkClass}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 sm:flex">
          <Link
            href="/masuk"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg  px-3.5 text-sm font-semibold text-ink transition-colors hover:border-primary/40 hover:bg-primary-soft/40 hover:text-primary"
          >
            <LogIn aria-hidden className="size-4" />
            Masuk
          </Link>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <Link
            href="/daftar"
            className="inline-flex min-h-9 items-center rounded-lg bg-primary px-3 text-sm font-semibold text-white sm:hidden"
          >
            Daftar
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Tutup menu navigasi" : "Buka menu navigasi"}
            className="grid size-10 place-items-center rounded-lg border border-border text-ink transition-colors hover:bg-primary-soft/40"
          >
            {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-white lg:hidden">
          <nav className="mx-auto max-w-[90rem] px-4 py-3 sm:px-6" aria-label="Navigasi mobile">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-ink hover:bg-primary-soft/50"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mx-auto flex max-w-[90rem] flex-col gap-2 px-4 pb-4 sm:hidden">
            <Link
              href="/masuk"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border text-sm font-semibold text-ink"
            >
              Masuk akun
            </Link>
            <Link
              href="/daftar"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-white"
            >
              Daftar KTA
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

export function SiteFooter({ className = "" }: { className?: string }) {
  return (
    <footer className={`border-t border-border bg-white ${className}`}>
      <div className="mx-auto max-w-[90rem] px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <LogoMark size={32} />
              <div className="leading-tight">
                <p className="text-sm font-bold tracking-tight text-ink">IKADI</p>
                <p className="text-xs text-ink-muted">Ikatan Da&apos;i Indonesia</p>
              </div>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-muted">
              Portal resmi pendataan dan penerbitan Kartu Tanda Anggota IKADI untuk anggota dan pengurus di seluruh wilayah.
            </p>
          </div>

          <nav aria-label="Tautan layanan">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Layanan</p>
            <ul className="mt-3 space-y-2 text-sm">
              {[
                { href: "/daftar", label: "Pendaftaran KTA" },
                { href: "/masuk", label: "Masuk akun" },
                { href: "/#faq", label: "Pertanyaan umum" },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-ink-muted transition-colors hover:text-primary">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Sekretariat</p>
            <div className="mt-3 space-y-1.5 text-sm leading-relaxed text-ink-muted">
              <p className="font-medium text-ink">Pengurus Pusat IKADI</p>
              <p>Senin–Jumat, 08.30–16.00 WIB</p>
              <p className="text-xs">Bantuan pendaftaran dan verifikasi dikoordinasikan melalui pengurus PW/PD setempat.</p>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-border pt-5 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© Ikatan Da&apos;i Indonesia. Seluruh hak dilindungi.</p>
          <p>Portal resmi keanggotaan IKADI</p>
        </div>
      </div>
    </footer>
  );
}
