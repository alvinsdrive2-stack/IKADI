import type { Metadata } from "next";
import { ChangePassword } from "@/components/ChangePassword";

export const metadata: Metadata = { title: "Ganti Sandi | IKADI" };

export default function GantiSandiPage() {
  return <ChangePassword />;
}
