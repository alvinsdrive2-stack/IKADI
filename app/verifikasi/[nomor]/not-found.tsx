import Link from "next/link";
import { LogoMark } from "@/components/Logo";

export const metadata = {
  title: "Kartu tidak dikenali — IKADI",
};

export default function VerifikasiNotFound() {
  return (
    <main id="main" className="mx-auto w-full max-w-lg px-4 py-10 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <LogoMark />
        <span className="text-base font-semibold text-primary-ink">
          Verifikasi Kartu Tanda Anggota IKADI
        </span>
      </div>

      <section
        role="alert"
        className="relative overflow-hidden rounded-xl border border-danger-border bg-danger-soft p-6"
      >
        <div aria-hidden className="ornament-girih absolute inset-0" />
        <h1 className="relative text-lg font-semibold text-danger">
          Kartu tidak dikenali
        </h1>
        <p className="relative mt-2 text-base text-ink">
          Kode QR ini bukan kartu KTA IKADI yang sah. Jika Anda menerima kartu
          ini dari seseorang, hubungi pengurus IKADI untuk memastikan
          keasliannya.
        </p>
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
