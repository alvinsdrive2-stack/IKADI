import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MEMBERSHIP_STATUS_LABELS } from "@/components/constants";
import { LogoMark } from "@/components/Logo";
import { VerifikasiGate } from "@/components/VerifikasiGate";
import { getMemberCard } from "@/lib/queries";
import { displayMemberNumber } from "@/lib/member-number";

export const metadata: Metadata = {
  title: "Verifikasi KTA — IKADI",
};

// Nomor dibaca dari params di server; tanpa static shell.
export const instant = false;

/** Format simpan: L.WW.DD.YY.NNNNN. Serial 5 digit (00100 ke atas);
 *  4 digit diterima untuk nomor lama yang terbit sebelum format berubah. */
const NOMOR_RE = /^[1-7]\.\d{2}\.\d{2}\.\d{2}\.(?:\d{4}|\d{5})$/;

export default async function VerifikasiPage({
  params,
}: PageProps<"/verifikasi/[nomor]">) {
  const { nomor } = await params;
  // Format salah = tidak dikenali; jangan query DB dengan input sembarang.
  if (!NOMOR_RE.test(nomor)) notFound();

  const kartu = await getMemberCard(nomor);
  if (!kartu) notFound();

  const terbit = new Date(kartu.memberNumberIssuedAt ?? kartu.createdAt);
  // Nomor ada di DB = kartu asli. Status keanggotaan terpisah: kartu NONAKTIF tetap
  // dikenali, tapi header tidak boleh mengklaim "sah" seolah masih berlaku.
  const aktif = kartu.membershipStatus === "AKTIF";
  const statusLabel = MEMBERSHIP_STATUS_LABELS[kartu.membershipStatus] ?? kartu.membershipStatus;
  const wilayah = [kartu.provinceName, kartu.regencyName].filter(Boolean).join(" · ") || "—";

  return (
    <main id="main" className="vpage">
      <div aria-hidden className="vpage-facets" />

      <VerifikasiGate>
        <div className="vpage-inner">
          <header className="vpage-head mt-12">
            <LogoMark variant="white" size={72} priority className="vpage-mark" />
            <div className="min-w-0">
              <p className="vpage-eyebrow">IKATAN DA&apos;I INDONESIA</p>
              <h1 className="vpage-title">Verifikasi Kartu Tanda Anggota</h1>
            </div>
          </header>

          <section className={`vcard ${aktif ? "" : "vcard-inactive"}`}>
            <div className="vcard-shimmer" aria-hidden />

            <div className="vcard-name-block">
              <p className="vcard-name">{kartu.fullName}</p>
              <p className="vcard-level">{kartu.levelLabel}</p>
            </div>

            <div className="vcard-number-block">
              <p className="vcard-label">
                {kartu.isActiveCard ? "Nomor anggota" : "Nomor anggota berlaku"}
              </p>
              <p className="vcard-number">
                {displayMemberNumber(kartu.activeMemberNumber ?? kartu.memberNumber)}
              </p>
              {!kartu.isActiveCard && (
                <p className="vcard-label">
                  Kartu ini sudah diganti. Nomor {displayMemberNumber(kartu.memberNumber)} tidak berlaku lagi.
                </p>
              )}
            </div>

            <dl className="vcard-grid">
              <div>
                <dt className="vcard-label">Wilayah</dt>
                <dd className="vcard-value">{wilayah}</dd>
              </div>
              <div>
                <dt className="vcard-label">Status keanggotaan</dt>
                <dd className="vcard-value">{statusLabel}</dd>
              </div>
              <div>
                <dt className="vcard-label">Tanggal terbit</dt>
                <dd className="vcard-value">
                  {terbit.toLocaleDateString("id-ID", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                    timeZone: "Asia/Jakarta",
                  })}
                </dd>
              </div>
            </dl>

            <p className="vcard-note">
              Data ini berasal langsung dari basis data keanggotaan IKADI. Cocokkan nama dan nomor dengan kartu fisik.
            </p>
          </section>

        </div>
      </VerifikasiGate>
    </main>
  );
}
