"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button variant="ghost" size="sm" disabled={busy} loading={busy} onClick={async () => {
      setBusy(true);
      try { await fetch("/api/admin/logout", { method: "POST" }); } finally { router.replace("/masuk"); router.refresh(); }
    }}>
      <LogOut aria-hidden /> {busy ? "Keluar..." : "Keluar"}
    </Button>
  );
}

export function SessionExpired() {
  const router = useRouter();
  return (
    <div role="alert" className="rounded-lg border border-danger-border bg-danger-soft p-4 text-sm font-medium text-danger">
      Sesi Anda berakhir.{" "}
      <button type="button" onClick={() => router.replace("/masuk")} className="underline underline-offset-2">Silakan masuk kembali.</button>
    </div>
  );
}
