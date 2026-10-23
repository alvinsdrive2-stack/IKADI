import { requireAdmin } from "@/lib/auth";
import { getStats } from "@/lib/queries";


export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  return Response.json({ ok: true, ...(await getStats()) });
}
