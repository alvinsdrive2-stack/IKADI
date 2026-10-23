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
      <SiteHeader />
      <main id="main" className="flex flex-1 items-center justify-center px-4 py-16">
        <div
          role="status"
          className="w-full max-w-md rounded-xl border border-border bg-surface p-8 text-center shadow-card"
        >
          <span
            aria-hidden
            className="mx-auto grid size-20 place-items-center rounded-full bg-primary-soft"
          >
            <svg
              className="size-10 text-primary"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <AutoFocusH1 className="mt-6 text-2xl font-bold text-ink">
            Data berhasil dikirim.
          </AutoFocusH1>
          <p className="mt-2 text-base text-ink-muted">
            Terima kasih. Data Anda sudah kami terima dan akan diperiksa admin
            IKADI.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-md border border-primary bg-surface px-5 text-base font-semibold text-primary hover:bg-bg"
          >
            Kembali ke beranda
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
