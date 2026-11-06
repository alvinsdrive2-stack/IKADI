import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Banner halaman: panel hijau lembut + ornamen KTA, dengan overlay putih yang
 * memudar ke kanan. Komposisi warna sama dengan banner dashboard /admin.
 */
export function PageBanner({
  title,
  description,
  image = "/ornaments/2.svg",
  action,
  badge,
  back,
  headingId,
  className,
}: {
  title: string;
  description?: string;
  image?: string;
  action?: React.ReactNode;
  badge?: React.ReactNode;
  back?: { href: string; label: string };
  headingId?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      {back && (
        <Link
          href={back.href}
          className="mb-3 inline-flex min-h-10 items-center gap-1 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft aria-hidden className="size-4" /> {back.label}
        </Link>
      )}

      <section
        aria-labelledby={headingId}
        className="relative overflow-hidden rounded-xl border border-primary/20 bg-primary-soft"
      >
        <Image
          src={image}
          alt=""
          fill
          priority
          unoptimized
          sizes="(max-width: 1024px) 100vw, 88rem"
          className="object-cover object-right opacity-40"
        />
        {/* Overlay dari token --banner-veil di app/globals.css: putih pekat di kiri, memudar ke kanan. */}
        <div aria-hidden className="banner-veil absolute inset-0" />

        <div className="relative px-5 py-6 sm:px-6 sm:py-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1
                  id={headingId}
                  className="text-2xl font-bold tracking-tight text-ink sm:text-3xl"
                >
                  {title}
                </h1>
                {badge}
              </div>
              {description && (
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-muted">
                  {description}
                </p>
              )}
            </div>
            {action && <div className="shrink-0">{action}</div>}
          </div>
        </div>
      </section>
    </div>
  );
}
