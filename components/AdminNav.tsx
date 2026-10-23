"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      aria-busy={busy || undefined}
      onClick={async () => {
        setBusy(true);
        try {
          await fetch("/api/admin/logout", { method: "POST" });
        } finally {
          router.replace("/admin/login");
          router.refresh();
        }
      }}
      className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-ink-muted hover:bg-bg hover:text-primary disabled:opacity-60"
    >
      {busy ? "Keluar..." : "Keluar"}
    </button>
  );
}

export function SessionExpired() {
  const router = useRouter();
  return (
    <div
      role="alert"
      className="rounded-md border border-danger-border bg-danger-soft p-4 text-sm font-medium text-danger"
    >
      Sesi Anda berakhir.{" "}
      <button
        type="button"
        onClick={() => router.replace("/admin/login")}
        className="underline underline-offset-2"
      >
        Silakan masuk kembali.
      </button>
    </div>
  );
}
