import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, hasValidAdminSession } from "@/lib/auth";

// Cookie presence alone proves nothing: verify the sealed session here so a forged
// `ikadi_admin` value never reaches an admin page. Pages still re-check server-side.
export async function proxy(request: NextRequest) {
  if (await hasValidAdminSession(request.cookies)) return NextResponse.next();
  const loginUrl = new URL("/admin/login", request.url);
  if (request.cookies.has(SESSION_COOKIE)) {
    // Stale or forged cookie: clear it so the login page is not fighting a dead value.
    const res = NextResponse.redirect(loginUrl);
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin", "/admin/peserta/:path*"],
};
