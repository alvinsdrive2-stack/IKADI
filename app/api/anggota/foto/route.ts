import { prisma } from "@/lib/prisma";
import { requireAnggota } from "@/lib/auth";
import { saveParticipantPhoto, deleteParticipantPhoto } from "@/lib/photo";
import { jsonError } from "@/lib/http";
import { logRouteError } from "@/lib/route-log";
import { dataUrlImage, PHOTO_MAX_BYTES } from "@/lib/schema";

/**
 * POST /api/anggota/foto — anggota mengganti pas foto miliknya sendiri.
 * Dipakai untuk dua kasus: pas foto belum ada, atau foto lama terpotong
 * saat dicetak di kartu.
 *
 * Body: `{ photo: string }` berupa data URL gambar (JPEG/PNG/WebP).
 */
const photoSchema = dataUrlImage("Pas foto", PHOTO_MAX_BYTES, "pas foto");

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
    return jsonError(400, "BAD_REQUEST", "Body harus JSON valid");
  }

  const parsed = photoSchema.safeParse((body as { photo?: unknown } | null)?.photo);
  const photo = parsed.success ? parsed.data : undefined;
  if (!photo) {
    const msg = parsed.success ? "Pas foto wajib diisi" : (parsed.error.issues[0]?.message ?? "Foto tidak valid");
    return Response.json(
      { ok: false, code: "VALIDATION", message: "Periksa kembali foto yang diunggah.", errors: { photo: msg } },
      { status: 400 },
    );
  }

  let current: { photoPath: string | null } | null;
  try {
    current = await prisma.participant.findUnique({
      where: { id: BigInt(id) },
      select: { photoPath: true },
    });
  } catch (err) {
    logRouteError("POST /api/anggota/foto load", err);
    return jsonError(503, "SERVER_ERROR", "Layanan sedang tidak tersedia. Coba lagi nanti.");
  }
  if (!current) return jsonError(401, "UNAUTHORIZED", "Sesi tidak valid. Silakan login ulang.");

  let photoPath: string;
  try {
    photoPath = await saveParticipantPhoto(photo, id);
  } catch {
    return jsonError(400, "VALIDATION", "Foto tidak bisa dibaca. Coba unggah ulang.");
  }

  try {
    await prisma.participant.update({ where: { id: BigInt(id) }, data: { photoPath } });
  } catch (err) {
    logRouteError("POST /api/anggota/foto update", err);
    // Baris DB gagal diperbarui: file baru yatim, bersihkan supaya tidak menumpuk.
    await deleteParticipantPhoto(photoPath).catch(() => {});
    return jsonError(503, "SERVER_ERROR", "Layanan sedang tidak tersedia. Coba lagi nanti.");
  }

  // Foto lama dibuang setelah yang baru tersimpan, urutannya penting:
  // kalau update DB gagal, foto lama masih utuh.
  if (current.photoPath && current.photoPath !== photoPath) {
    await deleteParticipantPhoto(current.photoPath).catch(() => {});
  }

  return Response.json({ ok: true, data: { photoPath } });
}
