/**
 * Base URL publik untuk tautan verifikasi QR.
 *
 * Sumbernya env `PUBLIC_BASE_URL` saja, bukan host request. Aplikasi jalan
 * di belakang Nginx/PM2, jadi `request.url` bisa berisi 127.0.0.1 dan QR
 * hasilnya menunjuk localhost.
 *
 * Contoh `.env`:
 *   PUBLIC_BASE_URL="https://kta.ikadi.or.id"
 *
 * Wajib di-set di produksi. Tanpa itu, dev memakai origin request dan
 * produksi melempar error yang jelas daripada diam-diam mencetak QR ke
 * 127.0.0.1.
 */
export function publicBaseUrl(request: Request): string {
  const configured = process.env.PUBLIC_BASE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;

  const url = new URL(request.url);
  const host = url.hostname;
  const loopback = host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  if (!loopback) return `${url.protocol}//${url.host}`;

  // Loopback + tidak ada env: hanya boleh di dev. Di produksi lebih baik gagal
  // terang-terangan daripada mencetak QR yang tidak bisa dibuka siapa pun.
  if (process.env.NODE_ENV === "production") {
    throw new Error("PUBLIC_BASE_URL wajib di-set di produksi untuk membuat QR verifikasi");
  }
  return `${url.protocol}//${url.host}`;
}

/** Path halaman verifikasi untuk satu nomor anggota (sudah di-encode). */
export function verifyPath(memberNumber: string): string {
  return `/verifikasi/${encodeURIComponent(memberNumber)}`;
}
