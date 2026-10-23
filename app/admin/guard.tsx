import { redirect } from "next/navigation";
import { readAdminSession } from "@/lib/auth";

// Sesi dibaca di sini (bukan top-level layout) supaya cookie read tetap di dalam
// private cache scope. redirect() melempar, jadi hasilnya tidak pernah di-cache.
export async function AdminGuard({ children }: { children: React.ReactNode }) {
  "use cache: private";
  const session = await readAdminSession();
  if (!session) redirect("/admin/login");
  return children;
}

export async function AdminUsername() {
  "use cache: private";
  const session = await readAdminSession();
  if (!session) redirect("/admin/login");
  return (
    <span className="hidden text-sm text-ink-muted sm:inline">
      {session.username}
    </span>
  );
}
