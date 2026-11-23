import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { changePasswordSchema } from "@/lib/schema";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp, jsonError } from "@/lib/http";
import { logRouteError } from "@/lib/route-log";

/**
 * POST /api/admin/sandi — admin mengganti sandinya sendiri.
 *
 * Sandi lama wajib dibuktikan: sesi yang tertinggal di perangkat bersama tidak
 * cukup untuk mengambil alih akun admin. Akun admin lain tidak bisa disentuh
 * lewat jalur ini karena id diambil dari sesi, bukan dari body.
 */
export async function POST(request: Request) {
  const rl = rateLimit(`admin-sandi:${clientIp(request)}`, 5, 10 * 60_000);
  if (!rl.allowed) {
    return Response.json(
      { ok: false, code: "RATE_LIMIT", message: "Terlalu banyak percobaan. Coba lagi nanti." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const rawId = auth.session.adminId;
  if (!rawId || !/^\d{1,20}$/.test(rawId)) {
    return jsonError(401, "UNAUTHORIZED", "Sesi tidak valid. Silakan login ulang.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "VALIDATION", "Body harus JSON valid");
  }

  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "_");
      if (!errors[key]) errors[key] = issue.message;
    }
    return Response.json(
      { ok: false, code: "VALIDATION", message: "Periksa kembali isian Anda.", errors },
      { status: 400 },
    );
  }

  const d = parsed.data;

  let current: { passwordHash: string } | null;
  try {
    current = await prisma.admin.findUnique({
      where: { id: BigInt(rawId) },
      select: { passwordHash: true },
    });
  } catch (err) {
    logRouteError("POST /api/admin/sandi load", err);
    return jsonError(503, "SERVER_ERROR", "Layanan sedang tidak tersedia. Coba lagi nanti.");
  }
  if (!current) {
    return jsonError(401, "UNAUTHORIZED", "Sesi tidak valid. Silakan login ulang.");
  }

  const valid = await verifyPassword(current.passwordHash, d.currentPassword);
  if (!valid) {
    return Response.json(
      {
        ok: false,
        code: "VALIDATION",
        message: "Sandi saat ini salah.",
        errors: { currentPassword: "Sandi saat ini salah." },
      },
      { status: 400 },
    );
  }

  try {
    const passwordHash = await hashPassword(d.password);
    await prisma.admin.update({ where: { id: BigInt(rawId) }, data: { passwordHash } });
    return Response.json({ ok: true, data: { changed: true } });
  } catch (err) {
    logRouteError("POST /api/admin/sandi update", err);
    return jsonError(503, "SERVER_ERROR", "Layanan sedang tidak tersedia. Coba lagi nanti.");
  }
}
