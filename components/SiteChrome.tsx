import Link from "next/link";
import { Logo } from "@/components/Logo";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Logo />
        <Link
          href="/admin/login"
          className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-ink-muted hover:bg-bg hover:text-primary"
        >
          Masuk Admin
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <div className="mx-auto max-w-5xl space-y-1 px-4 py-6 text-sm text-ink-muted sm:px-6 lg:px-8">
        <p>Pengelola: Sekretariat IKADI (kontak menyusul).</p>
        <p>Data NIK Anda tidak ditampilkan kepada publik.</p>
      </div>
    </footer>
  );
}
