"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ExternalLink,
  FileCheck2,
  IdCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Scan,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { formatPersonName } from "@/components/constants";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  exact?: boolean;
};

export function AdminItems(): NavItem[] {
  return [
    { href: "/admin", label: "Ringkasan", icon: LayoutDashboard, exact: true },
    { href: "/admin/peserta", label: "Peserta", icon: Users },
    { href: "/admin/kta/pejabat", label: "Nama pejabat", icon: UserRound },
    { href: "/admin/kta/koordinat", label: "Koordinat KTA", icon: Scan },
  ];
}

export function AnggotaItems(): NavItem[] {
  return [
    { href: "/anggota", label: "Ringkasan", icon: LayoutDashboard, exact: true },
    { href: "/anggota/kartu", label: "Kartu anggota", icon: IdCard },
    { href: "/anggota/status", label: "Status pengajuan", icon: FileCheck2 },
    { href: "/anggota/profil", label: "Profil", icon: UserRound },
  ];
}

function initials(name?: string): string {
  if (!name) return "IK";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "IK";
}

function isActivePath(pathname: string, item: NavItem): boolean {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
}

/**
 * Kerangka dashboard admin & anggota.
 * Bahasa visual sama dengan halaman publik: latar putih, garis 1px, aksen hijau tipis.
 */
export function AppFrame({
  role,
  items,
  userLabel,
  onLogout,
  logoutBusy,
  children,
}: {
  role: "admin" | "anggota";
  items: NavItem[];
  userLabel?: string;
  onLogout: () => void;
  logoutBusy?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const displayName = userLabel ? formatPersonName(userLabel) : role === "admin" ? "Administrator" : "Anggota IKADI";
  const roleLabel = role === "admin" ? "Admin KTA" : "Keanggotaan";
  const current = items.find((it) => isActivePath(pathname, it));

  useEffect(() => {
    if (!profileOpen) return;
    const onDown = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProfileOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [profileOpen]);

  const nav = (
    <nav className="flex-1 px-3 py-4" aria-label={`Navigasi ${role}`}>
      <ul className="space-y-0.5">
        {items.map((it) => {
          const active = isActivePath(pathname, it);
          const Icon = it.icon;
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                onClick={() => setDrawer(false)}
                className={cn(
                  "flex min-h-10 items-center gap-2.5 rounded-md px-3 text-sm transition-colors",
                  active
                    ? "bg-primary-soft font-semibold text-primary-ink"
                    : "font-medium text-ink-muted hover:bg-bg hover:text-ink",
                )}
              >
                <Icon aria-hidden className={cn("size-4 shrink-0", active ? "text-primary" : "text-ink-muted")} strokeWidth={2} />
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  const asideFooter = (
    <div className="border-t border-border p-3">
      <Link
        href="/"
        className="flex min-h-10 items-center gap-2.5 rounded-md px-3 text-sm font-medium text-ink-muted transition-colors hover:bg-bg hover:text-ink"
      >
        <ExternalLink aria-hidden className="size-4 shrink-0" />
        Lihat situs
      </Link>
      <button
        type="button"
        onClick={onLogout}
        disabled={logoutBusy}
        className="flex min-h-10 w-full items-center gap-2.5 rounded-md px-3 text-sm font-medium text-ink-muted transition-colors hover:bg-bg hover:text-ink disabled:opacity-60"
      >
        <LogOut aria-hidden className="size-4 shrink-0" />
        {logoutBusy ? "Keluar..." : "Keluar"}
      </button>
    </div>
  );

  const brand = (
    <Link href={role === "admin" ? "/admin" : "/anggota"} className="flex items-center gap-2.5 mx-auto" aria-label="IKADI — dashboard">
      <LogoMark size={120} priority />
    </Link>
  );

  return (
    <div className="min-h-screen bg-white">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-white lg:flex" aria-label="Sidebar">
        <div className="flex h-16 items-center border-b border-border px-5">{brand}</div>
        {nav}
        {asideFooter}
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu navigasi">
          <button type="button" aria-label="Tutup menu" className="absolute inset-0 bg-ink/40" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-border bg-white">
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              {brand}
              <Button variant="ghost" size="icon" onClick={() => setDrawer(false)} aria-label="Tutup menu">
                <X aria-hidden />
              </Button>
            </div>
            {nav}
            {asideFooter}
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-border bg-white px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="icon" className="-ml-2 lg:hidden" onClick={() => setDrawer(true)} aria-label="Buka menu">
              <Menu aria-hidden />
            </Button>
            <p className="truncate text-sm font-semibold text-ink">{current?.label ?? "Dashboard"}</p>
          </div>

          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setProfileOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={profileOpen}
              className="flex min-h-10 items-center gap-2 rounded-full px-1.5 transition-colors hover:bg-bg"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary-ink">
                {initials(userLabel)}
              </span>
              <span className="hidden min-w-0 text-left sm:block">
                <span className="block max-w-[12rem] truncate text-sm font-medium leading-tight text-ink">{displayName}</span>
                <span className="block text-[11px] leading-tight text-ink-muted">{role === "admin" ? "Pengurus" : "Anggota"}</span>
              </span>
              <ChevronDown
                aria-hidden
                className={cn("hidden size-4 shrink-0 text-ink-muted transition-transform sm:block", profileOpen && "rotate-180")}
              />
            </button>

            {profileOpen && (
              <div
                role="menu"
                aria-label="Menu profil"
                className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-lg border border-border bg-white shadow-raised"
              >
                <div className="border-b border-border px-4 py-3">
                  <p className="truncate text-sm font-semibold text-ink">{displayName}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
                    <ShieldCheck aria-hidden className="size-3.5 text-primary" />
                    {role === "admin" ? "Akses admin" : "Akun anggota"}
                  </p>
                </div>
                <div className="p-1.5">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={onLogout}
                    disabled={logoutBusy}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm font-medium text-danger hover:bg-danger-soft disabled:opacity-60"
                  >
                    <LogOut aria-hidden className="size-4" />
                    {logoutBusy ? "Keluar..." : "Keluar"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        <main
          id="main"
          className={cn(
            "mx-auto w-full px-4 py-6 sm:px-6 lg:px-8 lg:py-8",
            role === "admin" ? "max-w-[88rem]" : "max-w-[80rem]",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
