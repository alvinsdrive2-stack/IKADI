import type { Metadata } from "next";
import { ProfileCompletion } from "@/components/ProfileCompletion";

export const metadata: Metadata = { title: "Lengkapi Profil — IKADI" };

export default function LengkapiProfilPage() {
  return <ProfileCompletion />;
}
