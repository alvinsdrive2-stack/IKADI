import { prisma } from "@/lib/prisma";
import { requireAnggota } from "@/lib/auth";
import { adminProfileSchema } from "@/lib/schema";
import { logRouteError } from "@/lib/route-log";
import { jsonError } from "@/lib/http";

/**
 * GET /api/anggota/profil/data — data pribadi milik sendiri, untuk form sunting.
 *
 * Proyeksi sengaja hanya field yang boleh diubah anggota. NIK tidak ikut
 * dikirim: nilainya tidak bisa diganti, dan halaman ini tidak membutuhkannya.
 */
export async function GET() {
  const auth = await requireAnggota();
  if (!auth.ok) return auth.response;

  const id = auth.session.participantId!;
  if (!/^\d{1,20}$/.test(id)) {
    return jsonError(401, "UNAUTHORIZED", "Sesi tidak valid. Silakan login ulang.");
  }

  try {
    const p = await prisma.participant.findUnique({
      where: { id: BigInt(id) },
      select: {
        fullName: true,
        whatsapp: true,
        birthPlace: true,
        birthDate: true,
        gender: true,
        maritalStatus: true,
        bloodType: true,
        addressKtp: true,
        addressCurrent: true,
        occupation: true,
        lastEducation: true,
        studyField: true,
        expertise: true,
      },
    });
    if (!p) return jsonError(404, "NOT_FOUND", "Data peserta tidak ditemukan");

    // Disusun eksplisit, bukan `...p`: id bertipe BigInt dan JSON tidak bisa
    // men-serialize-nya. Yang dikirim hanya field yang boleh dilihat pemiliknya.
    return Response.json({
      ok: true,
      data: {
        fullName: p.fullName,
        whatsapp: p.whatsapp,
        birthPlace: p.birthPlace,
        birthDate: p.birthDate.toISOString().slice(0, 10),
        gender: p.gender,
        maritalStatus: p.maritalStatus,
        bloodType: p.bloodType,
        addressKtp: p.addressKtp,
        addressCurrent: p.addressCurrent,
        occupation: p.occupation,
        lastEducation: p.lastEducation,
        studyField: p.studyField,
        expertise: p.expertise,
      },
    });
  } catch (err) {
    logRouteError("GET /api/anggota/profil/data", err);
    return jsonError(503, "SERVER_ERROR", "Layanan sedang tidak tersedia. Coba lagi nanti.");
  }
}

/**
 * PATCH /api/anggota/profil/data — anggota memperbarui datanya sendiri.
 *
 * Validasi memakai skema yang sama dengan suntingan admin: aturan isian tidak
 * boleh berbeda tergantung siapa yang menekan simpan. Yang tidak bisa diubah
 * anggota: NIK, wilayah, level, dan status keanggotaan — semuanya menentukan
 * identitas dan hak akses, jadi tetap jalur pengurus/admin.
 */
export async function PATCH(request: Request) {
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

  const parsed = adminProfileSchema.safeParse(body);
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
  try {
    await prisma.participant.update({
      where: { id: BigInt(id) },
      data: {
        fullName: d.fullName,
        whatsapp: d.whatsapp,
        birthPlace: d.birthPlace,
        birthDate: new Date(`${d.birthDate}T00:00:00Z`),
        gender: d.gender,
        maritalStatus: d.maritalStatus ?? null,
        bloodType: d.bloodType ?? null,
        address: d.address,
        addressKtp: d.addressKtp,
        addressCurrent: d.addressCurrent,
        addressSameAsKtp: d.addressSameAsKtp,
        occupation: d.occupation,
        lastEducation: d.lastEducation ?? null,
        studyField: d.studyField ?? null,
        expertise: d.expertise ?? null,
      },
    });
    return Response.json({ ok: true, data: { updated: true } });
  } catch (err) {
    logRouteError("PATCH /api/anggota/profil/data", err);
    return jsonError(503, "SERVER_ERROR", "Layanan sedang tidak tersedia. Coba lagi nanti.");
  }
}
