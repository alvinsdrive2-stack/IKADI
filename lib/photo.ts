import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";

/** Direktori penyimpanan pas foto. Di-serve statis oleh `public/`. */
export const PHOTO_DIR = path.join(process.cwd(), "public", "uploads", "participants");

const EXT_BY_MAGIC: { magic: number[]; ext: string }[] = [
  { magic: [0xff, 0xd8, 0xff], ext: "jpg" }, // JPEG
  { magic: [0x89, 0x50, 0x4e, 0x47], ext: "png" }, // PNG
  { magic: [0x52, 0x49, 0x46, 0x46], ext: "webp" }, // RIFF (WebP)
];

/** Ekstensi dari magic bytes — nama file dari user tidak pernah dipercaya. */
export function detectImageExt(buf: Buffer): string | null {
  for (const { magic, ext } of EXT_BY_MAGIC) {
    if (magic.every((b, i) => buf[i] === b)) return ext;
  }
  return null;
}

/**
 * Simpan pas foto sebagai `public/uploads/participants/<id>.<ext>`.
 * Id dipakai sebagai nama file — mencegah traversal & tabrakan antar peserta.
 * Mengembalikan path relatif yang disimpan ke kolom `photo_path`.
 */
export async function saveParticipantPhoto(photoBase64: string, participantId: string): Promise<string> {
  const buf = Buffer.from(photoBase64, "base64");
  const ext = detectImageExt(buf);
  if (!ext) throw new Error("PHOTO_INVALID");
  await mkdir(PHOTO_DIR, { recursive: true });
  const rel = `uploads/participants/${participantId}.${ext}`;
  await writeFile(path.join(process.cwd(), "public", rel), buf);
  return rel;
}

/** Hapus foto lama saat peserta mengganti pas foto. Path sudah divalidasi saat ditulis. */
export async function deleteParticipantPhoto(relPath: string): Promise<void> {
  if (!/^uploads\/participants\/\d+\.(jpg|png|webp)$/.test(relPath)) return;
  await rm(path.join(process.cwd(), "public", relPath), { force: true });
}
