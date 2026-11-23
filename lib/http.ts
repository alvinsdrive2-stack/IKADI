export function jsonError(status: number, code: string, message: string, extra?: object) {
  return Response.json({ ok: false, code, message, ...extra }, { status });
}

/**
 * Client IP for rate-limit keys; never logged.
 *
 * `X-Real-IP` first: nginx sets it from `$remote_addr`, so the client cannot
 * influence it. `X-Forwarded-For` is only a fallback because nginx appends to
 * that header rather than replacing it — taking its first element (what the
 * client sent) lets a caller pick a new rate-limit bucket per request and
 * walk past the login attempt limit.
 */
export function clientIp(request: Request): string {
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const xff = request.headers.get("x-forwarded-for");
  return xff?.split(",")[0]?.trim() || "unknown";
}
