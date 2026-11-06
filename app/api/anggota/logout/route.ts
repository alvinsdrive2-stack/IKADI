import { getAnggotaSession } from "@/lib/auth";

/** Logout anggota: destroy cookie. 200 walau belum login (idempotent). */
export async function POST() {
  try {
    const session = await getAnggotaSession();
    session.destroy();
  } catch {
    // Sudah logout / cookie rusak / secret berubah — tetap 200.
  }
  return Response.json({ ok: true, data: null });
}
