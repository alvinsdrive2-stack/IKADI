import { requireAdmin } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { getBulkJob, publicJob } from "@/lib/kta-bulk";

/** GET /api/admin/bulk/kta/:id, status pekerjaan, atau unduhan ZIP saat selesai. */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const job = getBulkJob(id);
  if (!job) return jsonError(404, "NOT_FOUND", "Pekerjaan ekspor tidak ditemukan atau sudah kedaluwarsa");

  const wantsFile = new URL(request.url).searchParams.get("download") === "1";
  if (wantsFile) {
    if (job.status !== "done" || !job.file) {
      return jsonError(409, "NOT_READY", "Berkas belum siap");
    }
    return new Response(new Uint8Array(job.file.data), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${job.file.name}"`,
        "Content-Length": String(job.file.data.length),
      },
    });
  }

  return Response.json({ ok: true, data: publicJob(job) });
}
