import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = {
  title: "Masuk Admin — Pendataan KTA IKADI",
};

export default function LoginPage() {
  return (
    <>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Logo />
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-primary"
          >
            &larr; Kembali ke beranda
          </Link>
        </div>
      </header>

      <main
        id="main"
        className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center sm:py-16"
      >
        <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-raised sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-ink">Masuk Admin</h1>
          <p className="mt-2 mb-6 text-base text-ink-muted">
            Halaman ini khusus pengurus IKADI. Masuk untuk melihat dan memantau
            data peserta.
          </p>
          <LoginForm />
        </div>
      </main>
    </>
  );
}
