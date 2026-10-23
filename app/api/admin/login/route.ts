import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/schema";
import { getAdminSession, hashPassword, verifyPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp, jsonError } from "@/lib/http";


// Cheap constant-ish work for unknown usernames so timing does not reveal account existence.
let dummyHash: string | null = null;
async function getDummyHash() {
  if (!dummyHash) dummyHash = await hashPassword("ikadi-dummy-password");
  return dummyHash;
}

export async function POST(request: Request) {
  const rl = rateLimit(`login:${clientIp(request)}`, 10, 15 * 60_000);
  if (!rl.allowed) {
    return Response.json(
      { ok: false, code: "RATE_LIMIT", message: "Terlalu banyak percobaan login. Coba lagi nanti." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "BAD_REQUEST", "Body harus JSON valid");
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "VALIDATION", "Username dan password wajib diisi");
  }

  const { username, password } = parsed.data;

  let admin: { id: bigint | number; username: string; passwordHash: string } | null;
  try {
    admin = await prisma.admin.findUnique({ where: { username } });
  } catch (err) {
    // DB down or misconfigured: never surface driver details, never 500 without JSON.
    console.error("POST /api/admin/login failed:", err instanceof Error ? err.name : "unknown");
    return jsonError(503, "SERVER_ERROR", "Layanan sedang tidak tersedia. Coba lagi nanti.");
  }

  const hash = admin?.passwordHash ?? (await getDummyHash());
  const valid = await verifyPassword(hash, password);

  if (!admin || !valid) {
    return Response.json(
      { ok: false, code: "UNAUTHORIZED", message: "Username atau password salah." },
      { status: 401 },
    );
  }

  try {
    const session = await getAdminSession();
    session.adminId = String(admin.id);
    session.username = admin.username;
    await session.save();
  } catch (err) {
    console.error("POST /api/admin/login session failed:", err instanceof Error ? err.name : "unknown");
    return jsonError(503, "SERVER_ERROR", "Layanan sedang tidak tersedia. Coba lagi nanti.");
  }

  return Response.json({ ok: true });
}
