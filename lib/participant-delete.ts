/**
 * Hapus peserta beserta jejaknya.
 *
 * `member_cards` dan `membership_histories` sudah ON DELETE CASCADE, tapi
 * `kta_prints` tidak punya foreign key ke `participants` (sengaja: riwayat cetak
 * harus tetap utuh walau peserta hilang). Jadi barisnya dibersihkan di sini,
 * eksplisit, supaya tidak ada riwayat yatim yang menunjuk id yang sudah dipakai
 * ulang.
 *
 * Berkas pas foto dan foto KTP ikut dihapus: kalau tidak, NIK dan wajah mantan
 * peserta tetap tersimpan di disk tanpa ada yang bisa melihat atau menghapusnya.
 */
import { prisma } from "@/lib/prisma";
import { deleteParticipantPhoto, deleteParticipantKtp } from "@/lib/photo";
import { logRouteError, isRecordNotFound } from "@/lib/route-log";

export type DeleteResult =
  | { ok: true; data: { id: string } }
  | { ok: false; status: number; code: string; message: string };

export async function deleteParticipant(id: bigint): Promise<DeleteResult> {
  let target: {
    id: bigint;
    fullName: string;
    photoPath: string | null;
    ktpPath: string | null;
  } | null;

  try {
    target = await prisma.participant.findUnique({
      where: { id },
      select: { id: true, fullName: true, photoPath: true, ktpPath: true },
    });
  } catch (err) {
    logRouteError("DELETE participant load", err);
    return {
      ok: false,
      status: 503,
      code: "SERVER_ERROR",
      message: "Layanan sedang tidak tersedia. Coba lagi nanti.",
    };
  }
  if (!target) {
    return { ok: false, status: 404, code: "NOT_FOUND", message: "Data peserta tidak ditemukan" };
  }

  try {
    // Satu transaksi: kalau salah satu gagal, tidak ada yang setengah terhapus.
    await prisma.$transaction([
      prisma.ktaPrint.deleteMany({ where: { participantId: id } }),
      prisma.participant.delete({ where: { id } }),
    ]);
  } catch (err) {
    if (isRecordNotFound(err)) {
      return { ok: false, status: 404, code: "NOT_FOUND", message: "Data peserta tidak ditemukan" };
    }
    logRouteError("DELETE participant", err);
    return {
      ok: false,
      status: 503,
      code: "SERVER_ERROR",
      message: "Layanan sedang tidak tersedia. Coba lagi nanti.",
    };
  }

  // Baris DB sudah hilang; kegagalan menghapus berkas tidak boleh membatalkan
  // hasil yang sudah sah, cukup dicatat.
  if (target.photoPath) {
    await deleteParticipantPhoto(target.photoPath).catch((err) => {
      logRouteError("DELETE participant photo", err);
    });
  }
  if (target.ktpPath) {
    await deleteParticipantKtp(target.ktpPath).catch((err) => {
      logRouteError("DELETE participant ktp", err);
    });
  }

  return { ok: true, data: { id: String(id) } };
}
