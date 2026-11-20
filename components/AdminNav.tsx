"use client";

import { useRouter } from "next/navigation";

export function SessionExpired() {
  const router = useRouter();
  return (
    <div role="alert" className="rounded-lg border border-danger-border bg-danger-soft p-4 text-sm font-medium text-danger">
      Sesi Anda berakhir.{" "}
      <button type="button" onClick={() => router.replace("/masuk")} className="underline underline-offset-2">Silakan masuk kembali.</button>
    </div>
  );
}
