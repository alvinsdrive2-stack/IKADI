"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/Alert";
import { Button } from "@/components/Button";
import { Input } from "@/components/Field";

export function LoginForm() {
  const router = useRouter();
  const errorRef = useRef<HTMLDivElement>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      if (res.ok) {
        router.replace("/admin");
        router.refresh();
        return;
      }
      setError(
        res.status === 429
          ? "Terlalu banyak percobaan. Tunggu satu menit lalu coba lagi."
          : "Email/Username atau sandi salah.",
      );
      requestAnimationFrame(() => errorRef.current?.focus());
    } catch {
      setError(
        "Koneksi bermasalah. Data belum terkirim — periksa internet lalu coba lagi.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <Input
        id="username"
        label="Username"
        name="username"
        autoComplete="username"
        required
        value={username}
        onChange={(e) => setUsername(e.target.value)}
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
