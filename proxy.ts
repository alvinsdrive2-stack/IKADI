import { NextResponse, type NextRequest } from "next/server";

// ponytail: optimistic cookie-presence check only. Every admin page/API re-verifies
// the signed session server-side via requireAdmin()/readAdminSession().
export function proxy(request: NextRequest) {
  if (request.cookies.has("ikadi_admin")) return NextResponse.next();
  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin", "/admin/peserta/:path*"],
};
