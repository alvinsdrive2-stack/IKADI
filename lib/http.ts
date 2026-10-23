export function jsonError(status: number, code: string, message: string, extra?: object) {
  return Response.json({ ok: false, code, message, ...extra }, { status });
}

/** Client IP from proxy headers; only used as a rate-limit key, never logged. */
export function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  return xff?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}
