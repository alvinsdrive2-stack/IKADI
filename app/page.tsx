import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { LogoMark } from "@/components/Logo";

const BENEFITS = [
  { title: "Isi satu kali per NIK", body: "Satu nomor NIK untuk satu data peserta." },
  { title: "Data hanya dilihat admin", body: "NIK tidak ditampilkan kepada publik." },
  { title: "Bisa diisi dari ponsel", body: "Formulir dirancang untuk layar kecil." },
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <section className="on-dark relative overflow-hidden bg-primary">
          <div aria-hidden className="ornament-light absolute inset-0" />
          <div className="relative mx-auto flex max-w-5xl flex-col items-center px-4 py-16 text-center sm:px-6 sm:py-24 lg:px-8">
            <div className="rounded-xl bg-white p-2">
              <LogoMark size={72} />
            </div>
            <p className="mt-6 text-sm font-medium tracking-wide text-primary-soft">
              Ikatan Dai Indonesia
            </p>
            <h1 className="mt-2 max-w-2xl text-3xl font-bold leading-tight tracking-tight text-white md:text-4xl">
              Pendataan Kartu Tanda Anggota IKADI
            </h1>
            <p className="mt-4 max-w-xl text-base text-primary-soft">
              Lengkapi data diri Anda untuk pendataan KTA IKADI.
            </p>
            <Link
              href="/daftar"
              className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-md bg-surface px-8 text-base font-semibold text-primary-hover hover:bg-primary-soft sm:w-auto"
            >
              Isi Formulir
            </Link>
          </div>
        </section>

        <section
          aria-label="Yang perlu diketahui"
          className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8"
        >
          <ul role="list" className="grid gap-4 sm:grid-cols-3">
            {BENEFITS.map((b) => (
              <li
                key={b.title}
                className="rounded-lg border border-border bg-surface p-5 shadow-card"
              >
                <h2 className="text-base font-semibold text-ink">{b.title}</h2>
                <p className="mt-1 text-sm text-ink-muted">{b.body}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
