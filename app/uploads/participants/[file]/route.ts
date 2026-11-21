import { readFile } from "node:fs/promises";
import path from "node:path";
import { PHOTO_DIR } from "@/lib/photo";

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * GET /uploads/participants/:file
 *
 * `public/` hanya diindeks saat build (`.nft.json` menyimpan daftar berkasnya),
 * jadi foto yang diunggah setelah deploy tidak pernah dilayani sebagai aset
 * statis. Route ini membaca berkasnya langsung dari disk tiap permintaan.
 *
 * Nama berkas dari URL tidak pernah dipakai apa adanya: hanya pola
 * `<angka>.<ext>` yang diterima, jadi tidak ada jalan keluar dari PHOTO_DIR.
 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ file: string }> },
) {
  const { file } = await ctx.params;
  const m = /^(\d{1,20})\.(jpg|png|webp)$/.exec(file ?? "");
  if (!m) return new Response("Not found", { status: 404 });

  let buf: Buffer;
  try {
    buf = await readFile(path.join(PHOTO_DIR, `${m[1]}.${m[2]}`));
  } catch {
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": MIME_BY_EXT[m[2]],
      // Nama berkas = id peserta dan isinya bisa diganti kapan saja, tapi
      // pemanggil menambahkan `?v=` saat foto berubah.
      "Cache-Control": "public, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
