import { requireAdmin } from "@/lib/auth";
import { createMemberCard, readMemberCards } from "@/lib/member-cards-route";
import { jsonError } from "@/lib/http";

/** GET /api/admin/participants/:id/kartu, riwayat kartu + nomor aktif. */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  return readMemberCards(ctx);
}

/**
 * POST /api/admin/participants/:id/kartu, terbitkan kartu baru.
 * Body opsional `{ memberNumber }` untuk nomor manual; tanpa body nomor
 * diterbitkan otomatis dari sequence.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text.trim()) body = JSON.parse(text);
  } catch {
    return jsonError(400, "VALIDATION", "Body harus JSON valid");
  }
  return createMemberCard(ctx, body);
}
