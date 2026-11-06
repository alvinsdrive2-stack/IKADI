import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, ANGGOTA_COOKIE, hasValidAdminSession, hasValidAnggotaSession } from "@/lib/auth";

// Verifikasi cookie sesi di edge; halaman tetap memeriksa ulang di server.
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const isAdmin = await hasValidAdminSession(request.cookies);
  const isAnggota = await hasValidAnggotaSession(request.cookies);

  // Satu halaman masuk untuk dua peran.
  if (path === "/masuk") {
    if (isAdmin) return NextResponse.redirect(new URL("/admin", request.url));
    if (isAnggota) return NextResponse.redirect(new URL("/anggota", request.url));
    return NextResponse.next();
  }

  // Alamat lama diarahkan ke halaman masuk tunggal.
  if (path === "/admin/login" || path === "/anggota/masuk") {
    return NextResponse.redirect(new URL("/masuk", request.url));
  }

  // Landing: kalau sudah login, langsung ke dashboard peran.
  if (path === "/") {
    if (isAdmin) return NextResponse.redirect(new URL("/admin", request.url));
    if (isAnggota) return NextResponse.redirect(new URL("/anggota", request.url));
    return NextResponse.next();
  }

  if (path.startsWith("/admin")) {
    if (isAdmin) return NextResponse.next();
    const res = NextResponse.redirect(new URL("/masuk", request.url));
    if (request.cookies.has(SESSION_COOKIE)) res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  if (path.startsWith("/anggota")) {
    if (isAnggota) return NextResponse.next();
    const res = NextResponse.redirect(new URL("/masuk", request.url));
    if (request.cookies.has(ANGGOTA_COOKIE)) res.cookies.delete(ANGGOTA_COOKIE);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/masuk", "/admin", "/admin/:path*", "/anggota", "/anggota/:path*"],
};
