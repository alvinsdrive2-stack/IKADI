import { requireAdmin } from "@/lib/auth";
import { activateCard } from "@/lib/member-cards-route";
import { jsonError } from "@/lib/http";

/** POST /api/admin/participants/:id/kartu/aktifkan — body `{ cardId }`. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "VALIDATION", "Body harus JSON valid");
  }
  return activateCard(ctx, body);
}
