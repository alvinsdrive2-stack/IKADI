import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LogoMark } from "@/components/Logo";
import { getPejabat } from "@/lib/kta";
import { MEMBERSHIP_STATUS_LABELS } from "@/components/constants";
import { getMemberCard } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Verifikasi KTA — IKADI",
};

// Nomor dibaca dari params di server; tanpa static shell.
export const instant = false;

const NOMOR_RE = /^[1-7]\.\d{2}\.\d{2}\.\d{2}\.\d{4}$/;

export default async function VerifikasiPage({
  params,
}: PageProps<"/verifikasi/[nomor]">) {
  const { nomor } = await params;
  // Format salah = tidak dikenali; jangan query DB dengan input sembarang.
  if (!NOMOR_RE.test(nomor)) notFound();

  const kartu = await getMemberCard(nomor);
  if (!kartu) notFound();

  const pejabat = await getPejabat();
  const terbit = new Date(kartu.memberNumberIssuedAt ?? kartu.createdAt);
  // Nomor ada di DB = kartu asli. Status keanggotaan terpisah: kartu NONAKTIF tetap
  // dikenali, tapi header tidak boleh mengklaim "sah" seolah masih berlaku.
  const aktif = kartu.membershipStatus === "AKTIF";
  const statusLabel = MEMBERSHIP_STATUS_LABELS[kartu.membershipStatus] ?? kartu.membershipStatus;

  return (
    <main id="main" className="mx-auto w-full max-w-lg px-4 py-10 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <LogoMark />
        <span className="text-base font-semibold text-primary-ink">
          Verifikasi Kartu Tanda Anggota IKADI
        </span>
      </div>

      <section className="relative overflow-hidden rounded-xl border border-border border-t-4 border-t-primary bg-surface shadow-card">
        <div aria-hidden className="ornament-girih absolute inset-0" />
        <div
          aria-hidden
          className="ornament-medallion pointer-events-none absolute -right-10 -top-10 size-40"
        />
        <div
          className={`relative flex items-center gap-2 border-b border-border px-5 py-4 ${
            aktif ? "bg-primary-soft" : "bg-accent-soft"
          }`}
        >
          <svg
            aria-hidden
            className={`size-5 shrink-0 ${aktif ? "text-primary" : "text-accent-ink"}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            {aktif ? (
              <path d="m5 13 4 4L19 7" />
            ) : (
              <path d="M12 8v5m0 3.5v.5M10.3 3.9 2.4 17.6A1.8 1.8 0 0 0 4 20.3h16a1.8 1.8 0 0 0 1.6-2.7L13.7 3.9a1.8 1.8 0 0 0-3.4 0Z" />
            )}
          </svg>
          <p className={`text-base font-semibold ${aktif ? "text-primary-ink" : "text-accent-ink"}`}>
            {aktif ? "Kartu terdaftar dan sah" : `Kartu terdaftar — status: ${statusLabel}`}
          </p>
        </div>

        <dl className="relative grid gap-y-4 px-5 py-5 text-base">
          <div>
            <dt className="text-sm text-ink-muted">Nama</dt>
            <dd className="font-semibold text-ink">{kartu.fullName}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">Nomor anggota</dt>
            <dd className="font-mono tabular-nums tracking-wide text-ink">
              {kartu.memberNumber}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">Level</dt>
            <dd className="text-ink">{kartu.levelLabel}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">Asal IKADI</dt>
            <dd className="text-ink">
              {kartu.originType} {kartu.originName}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">Wilayah</dt>
            <dd className="text-ink">
              {[kartu.provinceName, kartu.regencyName].filter(Boolean).join(" · ") ||
                "-"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">Status keanggotaan</dt>
            <dd className="text-ink">{statusLabel}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">Tanggal terbit</dt>
            <dd className="text-ink">
              {terbit.toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "long",
                year: "numeric",
                timeZone: "Asia/Jakarta",
              })}
            </dd>
          </div>
        </dl>

        <div className="relative grid grid-cols-2 gap-4 border-t border-border bg-bg px-5 py-4 text-center">
          <div>
            <p className="text-xs font-semibold text-ink-muted">Ketua Umum</p>
            <p className="mt-1 text-sm font-semibold text-ink">
              {pejabat.ketuaUmum.nama}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-ink-muted">
              Sekretaris Jenderal
            </p>
            <p className="mt-1 text-sm font-semibold text-ink">
              {pejabat.sekjen.nama}
            </p>
          </div>
        </div>
      </section>

      <p className="mt-8 text-center text-sm text-ink-muted">
        <Link
          href="/"
          className="font-medium text-primary underline underline-offset-2"
        >
          Pendataan KTA IKADI
        </Link>
      </p>
    </main>
  );
}
