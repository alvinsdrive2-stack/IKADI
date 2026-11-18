import { requireAdmin } from "@/lib/auth";
import { getMembership, updateMembership, type MembershipResult } from "@/lib/membership";
import { jsonError } from "@/lib/http";

/** Petakan hasil lib ke Response, bentuk body identik dengan implementasi lama. */
function respond(result: MembershipResult): Response {
  if (result.ok) return Response.json({ ok: true, data: result.data });
  if (result.errors) {
    return Response.json(
      { ok: false, code: result.code, message: result.message, errors: result.errors },
      { status: result.status },
    );
  }
  return jsonError(result.status, result.code, result.message);
}

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id: raw } = await ctx.params;
  if (!/^\d{1,20}$/.test(raw)) {
    return jsonError(404, "NOT_FOUND", "Data peserta tidak ditemukan");
  }

  return respond(await getMembership(BigInt(raw)));
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id: raw } = await ctx.params;
  if (!/^\d{1,20}$/.test(raw)) {
    return jsonError(404, "NOT_FOUND", "Data peserta tidak ditemukan");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "VALIDATION", "Body harus JSON valid");
  }

  return respond(await updateMembership(BigInt(raw), body));
}
