// In-memory stand-in for "@/lib/photo" (QA_MOCK=1). Tests must not touch the real filesystem.
// The alias loader swaps this file in only from the point QA_MOCK is set.
export const saved = [];

/** Panggilan penghapusan berkas, supaya tes bisa memastikan ikut dibersihkan. */
export const deleted = { photo: [], ktp: [] };

/** Set true untuk membuat panggilan hapus berikutnya gagal (uji jalur error). */
export const failNext = { value: false };

export async function saveParticipantPhoto(photoBase64, participantId) {
  saved.push({ photoBase64, participantId });
  return `uploads/participants/${participantId}.png`;
}

export async function deleteParticipantPhoto(relPath) {
  if (failNext.value) {
    failNext.value = false;
    throw new Error("Berkas tidak bisa dihapus");
  }
  deleted.photo.push(relPath);
}

export async function saveParticipantKtp(ktpBase64, participantId) {
  saved.push({ ktpBase64, participantId });
  return `ktp/${participantId}.png`;
}

export async function deleteParticipantKtp(relPath) {
  if (failNext.value) {
    failNext.value = false;
    throw new Error("Berkas tidak bisa dihapus");
  }
  deleted.ktp.push(relPath);
}

export function detectImageExt(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return "webp";
  return null;
}
