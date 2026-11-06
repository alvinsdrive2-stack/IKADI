import type { Metadata } from "next";
import { KtaOfficialsAdmin } from "@/components/KtaOfficialsAdmin";
import { PageBanner } from "@/components/PageBanner";

export const metadata: Metadata = {
  title: "Nama pejabat KTA — Admin IKADI",
};

export default function KtaPejabatPage() {
  return (
    <div className="space-y-5">
      <PageBanner
        headingId="page-h"
        title="Nama pejabat KTA"
        description="Nama Ketua Umum dan Sekretaris Jenderal yang tercetak di blok tanda tangan kartu. Satu set nama berlaku untuk semua anggota."
        image="/ornaments/1.svg"
        back={{ href: "/admin", label: "Kembali ke ringkasan" }}
      />
      <KtaOfficialsAdmin />
    </div>
  );
}
