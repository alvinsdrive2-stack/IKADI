import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/layout/AuthShell";
import { MasukForm } from "@/components/MasukForm";

export const metadata: Metadata = { title: "Masuk — Pendataan KTA IKADI" };

export default function MasukPage() {
  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[1.75rem]">Masuk</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
        Gunakan NIK 16 digit atau username pengurus untuk melanjutkan.
      </p>

      <div className="mt-7">
        <Suspense fallback={null}>
          <MasukForm />
        </Suspense>
      </div>

      <p className="mt-6 border-t border-border pt-4 text-xs leading-relaxed text-ink-muted">
        Dengan masuk, Anda menyetujui penggunaan data sesuai tujuan pendataan keanggotaan IKADI.
      </p>
    </AuthShell>
  );
}
