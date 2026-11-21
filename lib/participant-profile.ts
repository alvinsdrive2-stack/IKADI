/**
 * Suntingan admin atas data pribadi peserta.
 *
 * Ditaruh di lib (bukan langsung di route) supaya aturan mana yang boleh
 * diubah ada di satu tempat dan bisa dites tanpa HTTP.
 */
import { prisma } from "@/lib/prisma";
import { adminProfileSchema } from "@/lib/schema";
import { logRouteError, isRecordNotFound } from "@/lib/route-log";

export type ProfileEditError = {
  ok: false;
  status: number;
  code: string;
  message: string;
  errors?: Record<string, string>;
};

export type ProfileEditResult =
  | { ok: true; data: { id: string } }
  | ProfileEditError;

export async function updateParticipantProfile(
  id: bigint,
  patch: unknown,
): Promise<ProfileEditResult> {
  const parsed = adminProfileSchema.safeParse(patch);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "_");
      if (!errors[key]) errors[key] = issue.message;
    }
    return {
      ok: false,
      status: 400,
      code: "VALIDATION",
      message: "Periksa kembali isian Anda.",
      errors,
    };
  }

  const d = parsed.data;
  try {
    // Cek keberadaan dan update dalam satu operasi: update pada id yang tidak
    // ada melempar P2025, jadi tidak ada celah antara cek dan tulis.
    await prisma.participant.update({
      where: { id },
      data: {
        fullName: d.fullName,
        whatsapp: d.whatsapp,
        birthPlace: d.birthPlace,
        // Tanggal lahir bertipe DATE; simpan tengah malam UTC seperti saat pendaftaran.
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
    return { ok: true, data: { id: String(id) } };
  } catch (err) {
    if (isRecordNotFound(err)) {
      return { ok: false, status: 404, code: "NOT_FOUND", message: "Data peserta tidak ditemukan" };
    }
    logRouteError("PATCH profile participant", err);
    return {
      ok: false,
      status: 503,
      code: "SERVER_ERROR",
      message: "Layanan sedang tidak tersedia. Coba lagi nanti.",
    };
  }
}
