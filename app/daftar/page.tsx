import type { Metadata } from "next";
import { FileCheck2, IdCard, ShieldCheck } from "lucide-react";
import { ParticipantForm } from "@/components/ParticipantForm";
import { AuthShell } from "@/components/layout/AuthShell";

export const metadata: Metadata = {
  title: "Daftar Anggota — Pendataan KTA IKADI",
  description: "Formulir pendataan data peserta KTA IKADI.",
};

export default function DaftarPage() {
  return (
    <AuthShell wide image="/ornaments/1.svg">
      <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[1.75rem]">Formulir Pendaftaran KTA</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
        Lengkapi bertahap. Data tersimpan sebagai draf di perangkat Anda sampai dikirim.
      </p>

      <div className="mt-6 flex items-start gap-2.5 border-l-2 border-primary pl-3 text-sm leading-relaxed text-ink-muted">
        <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          NIK hanya dapat dilihat admin terautentikasi. Dengan mengirim formulir, Anda memahami data dipakai untuk pendataan
          dan pengurusan KTA IKADI.
        </p>
      </div>

      <div className="mt-8">
        <ParticipantForm />
      </div>

      <div className="mt-8 grid gap-4 border-t border-border pt-6 sm:grid-cols-3">
        {[
          { icon: IdCard, t: "Satu NIK untuk satu akun anggota." },
          { icon: FileCheck2, t: "Status pengajuan terlihat di dashboard." },
          { icon: ShieldCheck, t: "Sandi disimpan sebagai hash Argon2id." },
        ].map((x) => (
          <div key={x.t} className="flex items-start gap-2">
            <x.icon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2} />
            <p className="text-xs leading-relaxed text-ink-muted">{x.t}</p>
          </div>
        ))}
      </div>
    </AuthShell>
  );
}
