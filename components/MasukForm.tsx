"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, IdCard, ArrowRight } from "lucide-react";
import { Alert } from "@/components/Alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Satu formulir untuk anggota & admin.
 * Role ditentukan server dari identifier: 16 digit = NIK anggota, selain itu username admin.
 */
export function MasukForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const errorRef = useRef<HTMLDivElement>(null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isNik = /^\d{16}$/.test(identifier.trim());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });

      if (res.ok) {
        const body = await res.json().catch(() => null);
        const target = next && next.startsWith("/") ? next : (body?.data?.redirect ?? "/");
        router.replace(target);
        router.refresh();
        return;
      }

      setError(
        res.status === 429
          ? "Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi."
          : res.status === 400
            ? "Isi NIK/username dan sandi terlebih dahulu."
            : "NIK/username atau sandi salah.",
      );
      requestAnimationFrame(() => errorRef.current?.focus());
    } catch {
      setError("Koneksi bermasalah. Periksa internet lalu coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="identifier" className="block text-sm font-medium text-ink">
          NIK / Username <span className="text-primary" aria-hidden>*</span>
        </Label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {isNik ? <IdCard aria-hidden className="size-4" /> : <KeyRound aria-hidden className="size-4" />}
          </span>
          <Input
            id="identifier"
            name="identifier"
            autoComplete="username"
            inputMode={isNik ? "numeric" : "text"}
            required
            autoFocus
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value);
              setError(null);
            }}
            aria-describedby="identifier-hint"
            placeholder="NIK 16 digit atau username"
            className="pl-9"
          />
        </div>
        <p id="identifier-hint" className="text-xs text-ink-muted" aria-live="polite">
          Peran dikenali otomatis dari isian.
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="password" className="block text-sm font-medium text-ink">
            Sandi <span className="text-primary" aria-hidden>*</span>
          </Label>
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="text-sm font-medium text-primary underline-offset-2 hover:underline"
          >
            {showPassword ? "Sembunyikan" : "Tampilkan"}
          </button>
        </div>
        <Input
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
        />
      </div>

      {error && (
        <div ref={errorRef} tabIndex={-1}>
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      <Button type="submit" loading={loading} disabled={loading} className="w-full">
        {loading ? "Memeriksa…" : "Masuk"} {!loading && <ArrowRight aria-hidden />}
      </Button>

      <div className="border-t border-border pt-4 text-center text-sm text-ink-muted">
        Belum punya akun?{" "}
        <Link href="/daftar" className="font-semibold text-primary underline underline-offset-2">
          Daftar anggota
        </Link>
      </div>
    </form>
  );
}
