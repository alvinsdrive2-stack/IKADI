import { AnggotaShell } from "@/components/AnggotaShell";

export const metadata = {
  title: "Anggota — Dashboard IKADI",
};

export default function AnggotaLayout({ children }: { children: React.ReactNode }) {
  return <AnggotaShell>{children}</AnggotaShell>;
}
