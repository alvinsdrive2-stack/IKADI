import type { Metadata } from "next";
import Link from "next/link";
import { ParticipantForm } from "@/components/ParticipantForm";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "Isi Formulir — Pendataan KTA IKADI",
  description: "Formulir pendataan data peserta KTA IKADI.",
};

export default function DaftarPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          <Link
            href="/"
            className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-hover"
          >
            &larr; Kembali ke beranda
          </Link>
          <div className="relative mb-6 overflow-hidden rounded-xl border border-border bg-surface p-5 shadow-card sm:p-6">
            <div aria-hidden className="ornament absolute inset-0" />
            <div className="relative">
              <h1 className="text-2xl font-bold text-ink">Formulir Pendataan KTA</h1>
              <p className="mt-2 text-base text-ink-muted">
                Data yang Anda isi digunakan IKADI untuk pendataan dan pengurusan
                Kartu Tanda Anggota. NIK Anda hanya dapat dilihat oleh admin dan
                tidak ditampilkan kepada publik.
              </p>
            </div>
          </div>

          <ParticipantForm />

          <p className="mt-6 text-center text-sm text-ink-muted">
            <Link href="/" className="text-primary underline underline-offset-2">
              Kembali ke beranda
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
