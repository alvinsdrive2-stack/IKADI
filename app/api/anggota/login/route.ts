import { prisma } from "@/lib/prisma";
import { normalizeNik } from "@/lib/schema";
import { getAnggotaSession } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp, jsonError } from "@/lib/http";
import { logRouteError } from "@/lib/route-log";

// Cheap constant-ish work for unknown NIK so timing does not reveal account existence.
let dummyHash: string | null = null;
async function getDummyHash() {
  if (!dummyHash) dummyHash = await hashPassword("ikadi-dummy-anggota-password");
  return dummyHash;
}

export async function POST(request: Request) {
  const rl = rateLimit(`anggota-login:${clientIp(request)}`, 5, 10 * 60_000);
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

  const { nik: rawNik, password: rawPassword } = (body ?? {}) as { nik?: unknown; password?: unknown };
  const password = typeof rawPassword === "string" ? rawPassword : "";
  const nik = typeof rawNik === "string" ? (normalizeNik(rawNik) as string) : "";
  if (!/^\d{16}$/.test(nik) || password === "") {
    return jsonError(400, "VALIDATION", "NIK harus 16 digit dan sandi wajib diisi");
  }

  let participant: {
    id: bigint;
    fullName: string;
    memberNumber: string | null;
    levelCode: number;
    originType: "PW" | "PD";
    originName: string;
    passwordHash: string | null;
  } | null;
  try {
    participant = await prisma.participant.findUnique({
      where: { nik },
      select: {
        id: true,
        fullName: true,
        memberNumber: true,
        levelCode: true,
        originType: true,
        originName: true,
        passwordHash: true,
      },
    });
  } catch (err) {
    logRouteError("POST /api/anggota/login", err);
    return jsonError(503, "SERVER_ERROR", "Layanan sedang tidak tersedia. Coba lagi nanti.");
  }

  // Pesan sama untuk NIK tidak ada / belum set sandi / sandi salah — jangan bocorkan mana yang salah.
  const hash = participant?.passwordHash ?? (await getDummyHash());
  const valid = await verifyPassword(hash, password);
  if (!participant || !participant.passwordHash || !valid) {
    return Response.json(
      { ok: false, code: "UNAUTHORIZED", message: "NIK atau sandi salah." },
      { status: 401 },
    );
  }

  try {
    const session = await getAnggotaSession();
    session.participantId = String(participant.id);
    await session.save();
  } catch (err) {
    logRouteError("POST /api/anggota/login session", err);
    return jsonError(503, "SERVER_ERROR", "Layanan sedang tidak tersedia. Coba lagi nanti.");
  }

  return Response.json({
    ok: true,
    data: {
      fullName: participant.fullName,
      memberNumber: participant.memberNumber,
      levelCode: participant.levelCode,
      originType: participant.originType,
      originName: participant.originName,
    },
  });
}
