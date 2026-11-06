import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isUniqueViolation, logRouteError } from "@/lib/route-log";
import { registerSchema } from "@/lib/schema";
import { saveParticipantPhoto, saveParticipantKtp } from "@/lib/photo";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp, jsonError } from "@/lib/http";
import { hashPassword } from "@/lib/password";

const NIK_DUPLICATE = {
  ok: false,
  code: "NIK_DUPLICATE",
  message:
    "NIK ini sudah terdaftar. Silakan hubungi admin jika membutuhkan bantuan.",
} as const;

export async function POST(request: Request) {
  const rl = rateLimit(`submit:${clientIp(request)}`, 5, 10 * 60_000);
  if (!rl.allowed) {
    return Response.json(
      { ok: false, code: "RATE_LIMIT", message: "Terlalu banyak percobaan. Coba lagi nanti." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "VALIDATION", "Body harus JSON valid");
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "_");
      if (!errors[field]) errors[field] = issue.message;
    }
    return Response.json(
      { ok: false, code: "VALIDATION", message: "Periksa kembali isian Anda.", errors },
      { status: 400 },
    );
  }

  const d = parsed.data;

  // Validasi kode wilayah di master (boundary). Pasangan (provinsi, kab/kota) harus ada.
  const [prov, reg] = await Promise.all([
    prisma.province.findUnique({ where: { code: d.provinceCode }, select: { code: true } }),
    prisma.regency.findUnique({
      where: { provinceCode_code: { provinceCode: d.provinceCode, code: d.regencyCode } },
      select: { code: true },
    }),
  ]);
  if (!prov || !reg) {
    return Response.json(
      {
        ok: false,
        code: "VALIDATION",
        message: "Periksa kembali isian Anda.",
        errors: {
          provinceCode: prov ? undefined : "Provinsi tidak dikenali",
          regencyCode: reg ? undefined : "Kabupaten/Kota tidak dikenali",
        },
      },
      { status: 400 },
    );
  }

  // consent cuma validasi UI — bukan kolom di tabel participants.
  // photo/ktp diproses terpisah; password jadi passwordHash.
  const { photo, ktp, gender, consent: _consent, password, provinceCode, regencyCode, ...rest } = d;
  const passwordHash = await hashPassword(password);
  const data: Prisma.ParticipantCreateInput = {
    ...rest,
    gender,
    provinceCode,
    regencyCode,
    passwordHash,
    birthDate: new Date(`${rest.birthDate}T00:00:00Z`),
  };

  try {
    // UX pre-check only; the UNIQUE index below is the source of truth.
    const existing = await prisma.participant.findUnique({ where: { nik: d.nik }, select: { id: true } });
    if (existing) return Response.json(NIK_DUPLICATE, { status: 409 });

    const created = await prisma.participant.create({ data });
    if (photo) {
      try {
        const photoPath = await saveParticipantPhoto(photo, String(created.id));
        await prisma.participant.update({ where: { id: created.id }, data: { photoPath } });
      } catch {
        // Foto gagal ditulis: data peserta tetap tersimpan, foto bisa diunggah ulang nanti.
      }
    }
    if (ktp) {
      try {
        const ktpPath = await saveParticipantKtp(ktp, String(created.id));
        await prisma.participant.update({ where: { id: created.id }, data: { ktpPath } });
      } catch {
        // KTP gagal ditulis: data peserta tetap tersimpan, KTP bisa diunggah ulang nanti.
      }
    }
    return Response.json({ ok: true }, { status: 201 });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return Response.json(NIK_DUPLICATE, { status: 409 });
    }
    logRouteError("POST /api/participants", err);
    return jsonError(500, "SERVER_ERROR", "Terjadi kesalahan. Silakan coba lagi.");
  }
}
