import { Suspense } from "react";
import { Badge } from "@/components/Badge";
import { AdminGuard, AdminUsername } from "@/app/admin/guard";
import { LogoutButton } from "@/components/AdminNav";
import { Logo } from "@/components/Logo";

export const metadata = {
  title: "Admin — Pendataan KTA IKADI",
};

// Sesi dibaca per request (app/admin/guard.tsx), tidak ada static shell.
export const instant = false;

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Logo />
            <Badge variant="pw">Admin</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Suspense fallback={null}>
              <AdminUsername />
            </Suspense>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main
        id="main"
        className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8"
      >
        <AdminGuard>{children}</AdminGuard>
      </main>
    </>
  );
}
