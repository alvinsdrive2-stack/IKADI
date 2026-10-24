const NIK_DIGITS = /\b\d{16}\b/g;

/**
 * Log error route tanpa membocorkan PII.
 * `PrismaClientValidationError.message` bisa memuat seluruh argumen `data`
 * (termasuk NIK), jadi digit 16-angka di-mask dan `meta.data` dibuang.
 */
export function logRouteError(scope: string, err: unknown): void {
  if (!(err instanceof Error)) {
    console.error(`${scope} failed:`, "unknown error");
    return;
  }

  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code?: unknown }).code)
      : undefined;
  const target = (err as { meta?: { target?: unknown } }).meta?.target;

  console.error(`${scope} failed:`, {
    name: err.name,
    code,
    target: Array.isArray(target) ? target.join(",") : target ? String(target) : undefined,
    message: err.message.replace(NIK_DIGITS, "****"),
  });
}

/** UNIQUE constraint violation. Dicek lewat `code`, bukan `instanceof` — tahan bundler. */
export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: unknown }).code === "P2002"
  );
}
