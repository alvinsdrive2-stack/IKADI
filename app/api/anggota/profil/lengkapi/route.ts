import { prisma } from "@/lib/prisma";
import { requireAnggota } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { profileCompletionSchema } from "@/lib/schema";
import { jsonError } from "@/lib/http";
import { logRouteError } from "@/lib/route-log";

/**
 * POST /api/anggota/profil/lengkapi
 *
 * Hanya untuk peserta dengan `needsProfileCompletion = true` (hasil impor).
 * Sekali jalan: lengkapi tempat lahir/alamat/pekerjaan dan ganti sandi
 * sementara. Setelah sukses, penanda dimatikan sehingga tidak bisa dipakai
 * untuk mengganti sandi berulang tanpa sandi lama.
 */
export async function POST(request: Request) {
  const auth = await requireAnggota();
  if (!auth.ok) return auth.response;

  const id = auth.session.participantId!;
  if (!/^\d{1,20}$/.test(id)) {
    return jsonError(401, "UNAUTHORIZED", "Sesi tidak valid. Silakan login ulang.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "VALIDATION", "Body harus JSON valid");
  }

  const parsed = profileCompletionSchema.safeParse(body);
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

  let current;
  try {
    current = await prisma.participant.findUnique({
      where: { id: BigInt(id) },
      select: { needsProfileCompletion: true },
    });
  } catch (err) {
    logRouteError("POST /api/anggota/profil/lengkapi load", err);
    return jsonError(503, "SERVER_ERROR", "Layanan sedang tidak tersedia. Coba lagi nanti.");
  }
  if (!current) return jsonError(404, "NOT_FOUND", "Data peserta tidak ditemukan");
  if (!current.needsProfileCompletion) {
    return jsonError(409, "ALREADY_COMPLETE", "Profil sudah lengkap.");
  }

  try {
    const passwordHash = await hashPassword(d.password);
    await prisma.participant.update({
      where: { id: BigInt(id) },
      data: {
        birthPlace: d.birthPlace,
        address: d.address,
        addressKtp: d.addressKtp,
        addressCurrent: d.addressCurrent ?? null,
        addressSameAsKtp: d.addressSameAsKtp,
        occupation: d.occupation,
        passwordHash,
        needsProfileCompletion: false,
      },
    });
    return Response.json({ ok: true, data: { completed: true } });
  } catch (err) {
    logRouteError("POST /api/anggota/profil/lengkapi update", err);
    return jsonError(503, "SERVER_ERROR", "Layanan sedang tidak tersedia. Coba lagi nanti.");
  }
}
