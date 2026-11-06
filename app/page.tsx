import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronDown,
  FileCheck2,
  IdCard,
  LayoutDashboard,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { Reveal } from "@/components/motion/Reveal";
import { LogoMark } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Pendataan KTA IKADI — Portal Layanan Keanggotaan",
  description:
    "Portal resmi pendataan, verifikasi, dan penerbitan Kartu Tanda Anggota IKADI. Satu akun untuk anggota dan pengurus, dengan kartu digital ber-QR.",
};

const STEPS = [
  {
    n: "01",
    title: "Isi data diri",
    body: "Formulir bertahap dengan pilihan unggah KTP atau isi manual. Draf tersimpan selama pengisian.",
  },
  {
    n: "02",
    title: "Verifikasi pengurus",
    body: "Pengurus wilayah memeriksa berkas. NIK dan kontak pribadi hanya terlihat oleh admin berwenang.",
  },
  {
    n: "03",
    title: "Kartu terbit",
    body: "Nomor anggota dan kartu digital ber-QR aktif. Kartu dapat dibuka dan dicetak kapan saja.",
  },
];

const SERVICES = [
  {
    icon: FileCheck2,
    title: "Pendataan anggota",
    body: "Satu NIK untuk satu akun, dengan draf yang aman saat koneksi terputus.",
    href: "/daftar",
  },
  {
    icon: IdCard,
    title: "KTA digital",
    body: "Nomor anggota permanen dan kartu digital ber-QR setelah pencetakan oleh pengurus.",
    href: "/anggota/kartu",
  },
  {
    icon: LayoutDashboard,
    title: "Dashboard pengurus",
    body: "Pantau peserta, filter wilayah, dan kelola penerbitan kartu anggota.",
    href: "/masuk",
  },
];

const FAQS = [
  {
    q: "Apa itu portal pendataan KTA IKADI?",
    a: "Layanan digital resmi untuk pendataan anggota, verifikasi berkas oleh pengurus, dan penerbitan Kartu Tanda Anggota IKADI dalam bentuk digital maupun cetak.",
  },
  {
    q: "Bagaimana cara masuk ke dashboard?",
    a: "Gunakan satu halaman masuk. Masukkan NIK 16 digit untuk akun anggota, atau nama pengguna pengurus untuk akun admin. Sistem mengenali peran secara otomatis.",
  },
  {
    q: "Kapan nomor anggota dan kartu saya terbit?",
    a: "Nomor anggota terbit setelah pengurus memverifikasi berkas dan mencetak kartu. Setelah itu nomor dan QR verifikasi langsung tampil di dashboard anggota.",
  },
  {
    q: "Apakah NIK saya dapat dilihat publik?",
    a: "Tidak. Halaman verifikasi publik hanya menampilkan nama, nomor anggota, wilayah, dan status keabsahan kartu. NIK hanya tersedia untuk pengurus terautentikasi.",
  },
  {
    q: "Bagaimana jika NIK sudah terdaftar?",
    a: "Satu NIK hanya dapat digunakan untuk satu akun. Jika Anda memerlukan bantuan akses, hubungi pengurus IKADI di wilayah Anda.",
  },
];

function KartuAnggota({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`rounded-xl border border-border bg-white shadow-card ${compact ? "p-4" : "p-5 sm:p-6"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <LogoMark size={compact ? 24 : 28} />
          <div className="leading-tight">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Kartu Tanda Anggota</p>
            <p className="text-sm font-bold text-ink">IKADI</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-md bg-primary-soft px-2 py-1 text-[10px] font-semibold text-primary-ink">
          <ShieldCheck aria-hidden className="size-3" />
          Terverifikasi
        </span>
      </div>

      <p className={`mt-5 font-mono font-bold tracking-wide text-ink ${compact ? "text-base" : "text-lg"}`}>
        6.16.01.26.0001
      </p>
      <p className="mt-1 text-sm font-semibold text-ink">Nama Anggota</p>
      <p className="text-xs text-ink-muted">PW Jawa Timur · Anggota</p>

      <div className="mt-4 flex items-end justify-between gap-4 border-t border-border pt-4">
        <div className="space-y-1 text-[11px] text-ink-muted">
          <p>Satu NIK, satu akun</p>
          <p>Berlaku selama keanggotaan aktif</p>
        </div>
        <div className="grid size-14 shrink-0 place-items-center rounded-md border border-border bg-white">
          <QrCode aria-hidden className="size-9 text-ink" strokeWidth={1.5} />
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1 bg-white">
        {/* Hero */}
        <section className="border-b border-border/70 bg-white">
          <div className="mx-auto grid max-w-[90rem] gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14 lg:px-8 lg:py-16">
            <Reveal y={12}>
              <h1 className="max-w-xl text-3xl font-bold leading-[1.15] tracking-tight text-ink sm:text-4xl lg:text-[2.75rem]">
                Pendataan KTA IKADI, tertib dari formulir sampai kartu terbit.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg">
                Daftar sekali, lengkapi berkas dengan bantuan pembacaan KTP, lalu pantau verifikasi pengurus sampai kartu digital dan cetak Anda aktif.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/daftar">
                    Mulai pendaftaran
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link href="/masuk">Masuk akun</Link>
                </Button>
              </div>

              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-muted">
                {["NIK tidak tampil publik", "QR verifikasi resmi", "Diproses pengurus wilayah"].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <Check aria-hidden className="size-4 text-primary" strokeWidth={2.5} />
                    {t}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal y={16} delay={80}>
              <div className="relative overflow-hidden rounded-xl border border-primary/15 bg-primary-soft">
                <Image
                  src="/ornaments/1.svg"
                  alt=""
                  fill
                  priority
                  unoptimized
                  sizes="(max-width: 1024px) 100vw, 45vw"
                  className="object-cover"
                />
                <div className="relative p-5 sm:p-8">
                  <KartuAnggota />
                  <div className="mt-3 flex items-center justify-between rounded-lg bg-white/85 px-3 py-2 text-xs text-ink-muted backdrop-blur-sm">
                    <span>Contoh kartu anggota</span>
                    <span className="font-medium text-primary-ink">QR verifikasi aktif</span>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Alur */}
        <section id="alur" className="scroll-mt-20 bg-white">
          <div className="mx-auto max-w-[90rem] px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
            <Reveal>
              <h2 className="max-w-2xl text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                Tiga langkah, satu alur yang jelas
              </h2>
              <p className="mt-2 max-w-2xl text-base leading-relaxed text-ink-muted">
                Tidak ada berkas yang berpindah-pindah. Setiap tahap tercatat dan dapat dipantau dari akun Anda.
              </p>
            </Reveal>

            <Reveal className="mt-9 grid gap-7 border-t border-border pt-8 sm:grid-cols-3" staggerChildren={60} y={10}>
              {STEPS.map((s, i) => (
                <div key={s.n} className={i === 0 ? "" : "sm:border-l sm:border-border sm:pl-7"}>
                  <p className="text-xs font-semibold tabular-nums text-primary">{s.n}</p>
                  <h3 className="mt-2 text-base font-semibold text-ink">{s.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-muted">{s.body}</p>
                </div>
              ))}
            </Reveal>
          </div>
        </section>

        {/* Layanan */}
        <section id="layanan" className="scroll-mt-20 border-y border-border bg-white">
          <div className="mx-auto max-w-[90rem] px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
            <Reveal>
              <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Layanan utama</h2>
              <p className="mt-2 max-w-2xl text-base leading-relaxed text-ink-muted">
                Tiga pintu masuk untuk anggota, pengurus, dan publik.
              </p>
            </Reveal>

            <div className="mt-8 border-t border-border">
              {SERVICES.map((s) => (
                <Link
                  key={s.title}
                  href={s.href}
                  className="group grid gap-3 border-b border-border py-5 sm:grid-cols-[auto_1fr_auto] sm:items-start sm:gap-6"
                >
                  <s.icon aria-hidden className="size-5 text-primary" strokeWidth={2} />
                  <div>
                    <h3 className="text-base font-semibold text-ink group-hover:text-primary">{s.title}</h3>
                    <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-muted">{s.body}</p>
                  </div>
                  <span className="hidden items-center gap-1 text-sm font-medium text-primary sm:inline-flex">
                    Buka
                    <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Kartu anggota */}
        <section id="kartu" className="scroll-mt-20 bg-white">
          <div className="mx-auto grid max-w-[90rem] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-8 lg:py-18">
            <Reveal y={12}>
              <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Kartu anggota digital dan cetak</h2>
              <p className="mt-3 text-base leading-relaxed text-ink-muted">
                Setelah pengurus mencetak kartu, nomor anggota 15 digit dan QR verifikasi aktif. Anggota dapat membuka dan mencetak kartu kapan saja dari dashboard.
              </p>
              <ul className="mt-5 space-y-2.5 text-sm text-ink">
                {["Nomor anggota permanen dan unik", "QR menuju halaman verifikasi resmi", "Ukuran cetak ID-1 standar kartu"].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2.5} />
                    {t}
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild>
                  <Link href="/masuk">Lihat di dashboard</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/daftar">Ajukan kartu</Link>
                </Button>
              </div>
            </Reveal>

            <Reveal y={16} delay={80}>
              <div className="relative overflow-hidden rounded-xl border border-primary/15 bg-primary-soft p-5 sm:p-8">
                <Image
                  src="/ornaments/2.svg"
                  alt=""
                  fill
                  unoptimized
                  sizes="(max-width: 1024px) 100vw, 45vw"
                  className="object-cover"
                />
                <div className="relative">
                  <KartuAnggota compact />
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 border-t border-border bg-white">
          <div className="mx-auto grid max-w-[90rem] gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16 lg:px-8 lg:py-18">
            <Reveal>
              <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Yang mungkin ditanyakan</h2>
              <p className="mt-2 max-w-sm text-base leading-relaxed text-ink-muted">
                Belum menemukan jawaban? Hubungi pengurus IKADI di wilayah Anda.
              </p>
            </Reveal>
            <Reveal className="divide-y divide-border border-t border-border" staggerChildren={40} y={8}>
              {FAQS.map((f) => (
                <details key={f.q} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium text-ink [marker]:content-none">
                    {f.q}
                    <ChevronDown aria-hidden className="size-5 shrink-0 text-ink-muted transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">{f.a}</p>
                </details>
              ))}
            </Reveal>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-white pb-16">
          <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-8">
            <Reveal>
              <div className="relative overflow-hidden rounded-xl border border-primary/15">
                <Image
                  src="/ornaments/1.svg"
                  alt=""
                  fill
                  unoptimized
                  sizes="(max-width: 1024px) 100vw, 90rem"
                  className="object-cover"
                />
                <div className="relative px-4 py-8 sm:px-8 lg:px-10 lg:py-10">
                  <div className="max-w-2xl rounded-xl border border-border bg-white p-6 shadow-card sm:p-8">
                    <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                      Siapkan KTP, mulai pendaftaran hari ini.
                    </h2>
                    <p className="mt-2 text-base leading-relaxed text-ink-muted">
                      Pengisian sekitar lima menit. Kartu digital menunggu setelah pengurus mencetak.
                    </p>
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                      <Button asChild size="lg" className="w-full sm:w-auto">
                        <Link href="/daftar">
                          Daftar sekarang
                          <ArrowRight aria-hidden />
                        </Link>
                      </Button>
                      <Button asChild size="lg" variant="secondary" className="w-full sm:w-auto">
                        <Link href="/masuk">Masuk dashboard</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
