import { Suspense } from "react";
import { AdminGuard } from "@/app/admin/guard";
import { AdminShell } from "@/components/AdminShell";
import { readAdminSession } from "@/lib/auth";

export const metadata = {
  title: "Admin — Pendataan KTA IKADI",
};

export const instant = false;

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <AdminGuard>
      <Suspense fallback={null}>
        <AdminShellWithUser>{children}</AdminShellWithUser>
      </Suspense>
    </AdminGuard>
  );
}

async function AdminShellWithUser({ children }: { children: React.ReactNode }) {
  const username = await AdminUsernameValue();
  return <AdminShell username={username}>{children}</AdminShell>;
}

/** Sama seperti AdminGuard: baca cookie di private cache scope agar tidak
 *  memicu blocking-prerender (iron-session memakai Date.now saat unseal). */
async function AdminUsernameValue(): Promise<string | undefined> {
  "use cache: private";
  const session = await readAdminSession();
  return session?.username;
}
