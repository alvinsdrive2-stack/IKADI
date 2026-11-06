"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert } from "@/components/Alert";
import { Button } from "@/components/Button";
import { Input } from "@/components/Field";

export function AnggotaLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/anggota";
  const errorRef = useRef<HTMLDivElement>(null);
  const [nik, setNik] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/anggota/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nik: nik.trim(), password }),
      });
      if (res.ok) {
        router.replace(next.startsWith("/") ? next : "/anggota");
        router.refresh();
        return;
      }
      setError(
        res.status === 429
          ? "Terlalu banyak percobaan. Coba lagi nanti."
          : "NIK atau sandi salah.",
      );
      requestAnimationFrame(() => errorRef.current?.focus());
    } catch {
      setError("Koneksi bermasalah. Periksa internet lalu coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <Input
        id="nik"
        label="NIK"
        name="nik"
        inputMode="numeric"
        maxLength={16}
        autoComplete="username"
        required
        hint="16 digit angka di KTP."
        value={nik}
        onChange={(e) => setNik(e.target.value.replace(/[^0-9]/g, ""))}
      />
      <Input
        id="sandi"
        label="Sandi"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && (
        <div ref={errorRef} tabIndex={-1}>
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      <Button
        type="submit"
        loading={loading}
        disabled={loading}
        className="w-full min-w-40"
      >
        {loading ? "Memproses..." : "Masuk"}
      </Button>
    </form>
  );
}
