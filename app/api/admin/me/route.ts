import { readAdminSession } from "@/lib/auth";
import { jsonError } from "@/lib/http";

/**
 * GET /api/admin/me — identitas admin yang sedang login.
 *
 * Hanya username dan id. Tidak ada hash sandi, dan tidak ada daftar admin lain:
 * endpoint ini untuk menampilkan siapa yang sedang masuk, bukan untuk
 * mengelola akun.
 */
export async function GET() {
  const session = await readAdminSession();
  if (!session?.adminId) {
    return jsonError(401, "UNAUTHORIZED", "Silakan login sebagai admin.");
  }
  return Response.json({
    ok: true,
    data: { id: session.adminId, username: session.username ?? null },
  });
}
