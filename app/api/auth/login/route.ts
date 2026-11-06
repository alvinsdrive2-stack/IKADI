import { prisma } from "@/lib/prisma";
import { normalizeNik } from "@/lib/schema";
import { getAdminSession, getAnggotaSession } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp, jsonError } from "@/lib/http";
import { logRouteError } from "@/lib/route-log";

/**
 * Login tunggal: role ditentukan dari identifier yang dimasukkan.
 * - 16 digit angka  -> anggota (NIK)
 * - selain itu      -> admin (username)
 */
let dummyHash: string | null = null;
async function getDummyHash() {
  if (!dummyHash) dummyHash = await hashPassword("ikadi-dummy-unified-password");
  return dummyHash;
}

const INVALID = {
  ok: false,
  code: "UNAUTHORIZED",
  message: "NIK/username atau sandi salah.",
} as const;

export async function POST(request: Request) {
  const rl = rateLimit(`auth-login:${clientIp(request)}`, 10, 15 * 60_000);
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

  const { identifier: rawIdentifier, username, nik, password: rawPassword } = (body ?? {}) as Record<string, unknown>;
  const identifier = String(rawIdentifier ?? username ?? nik ?? "").trim();
  const password = typeof rawPassword === "string" ? rawPassword : "";

  if (identifier === "" || password === "") {
    return jsonError(400, "VALIDATION", "NIK/username dan sandi wajib diisi.");
  }

  const normalizedNik = normalizeNik(identifier) as string;
  const isNumericNik = /^\d{16}$/.test(normalizedNik);

  try {
    if (isNumericNik) {
      const participant = await prisma.participant.findUnique({
        where: { nik: normalizedNik },
        select: { id: true, passwordHash: true },
      });

      const hash = participant?.passwordHash ?? (await getDummyHash());
      const valid = await verifyPassword(hash, password);
      if (!participant || !participant.passwordHash || !valid) {
        return Response.json(INVALID, { status: 401 });
      }

      const session = await getAnggotaSession();
      session.participantId = String(participant.id);
      await session.save();

      return Response.json({ ok: true, data: { role: "anggota", redirect: "/anggota" } });
    }

    const admin = await prisma.admin.findUnique({
      where: { username: identifier },
      select: { id: true, username: true, passwordHash: true },
    });

    const hash = admin?.passwordHash ?? (await getDummyHash());
    const valid = await verifyPassword(hash, password);
    if (!admin || !valid) {
      return Response.json(INVALID, { status: 401 });
    }

    const session = await getAdminSession();
    session.adminId = String(admin.id);
    session.username = admin.username;
    await session.save();

    return Response.json({ ok: true, data: { role: "admin", redirect: "/admin" } });
  } catch (err) {
    logRouteError("POST /api/auth/login", err);
    return jsonError(503, "SERVER_ERROR", "Layanan sedang tidak tersedia. Coba lagi nanti.");
  }
}
