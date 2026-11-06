import type { Metadata } from "next";
import Link from "next/link";
import { AutoFocusH1 } from "@/components/AutoFocusH1";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "Berhasil — Pendataan KTA IKADI",
};

export default function SuksesPage() {
  return (
    <>
      <SiteHeader className="hidden md:block" />
      <main id="main" className="flex flex-1 items-center justify-center px-4 py-16">
        <div role="status" className="w-full max-w-md text-center">
          <span
            aria-hidden
            className="mx-auto grid size-[76px] place-items-center rounded-full bg-primary-soft"
          >
            <svg
              className="size-[38px] text-primary"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <AutoFocusH1 className="mt-6 text-2xl font-bold text-ink">
            Data terkirim
          </AutoFocusH1>
          <p className="mt-2 text-base text-ink-muted">
            Data Anda tersimpan. Masuk dengan NIK dan sandi yang tadi dibuat untuk
            melihat status keanggotaan dan kartu Anda.
          </p>
          <p className="mt-4 rounded-md bg-bg p-3 text-left text-sm text-ink-muted">
            Simpan NIK dan sandi Anda. Nomor anggota terbit setelah admin mencetak
            KTA — sebelum itu kartu tampil tanpa nomor.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/anggota/masuk"
              className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-base font-semibold text-white hover:bg-primary-hover"
            >
              Masuk ke halaman anggota
            </Link>
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-md border border-primary bg-surface px-5 text-base font-semibold text-primary hover:bg-bg"
            >
              Selesai
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter className="hidden md:block" />
    </>
  );
}
