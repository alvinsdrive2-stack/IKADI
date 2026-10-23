/** `3576014241026002` -> `3576********6002` */
export function maskNik(nik: string): string {
  if (nik.length !== 16) return "*".repeat(nik.length);
  return `${nik.slice(0, 4)}${"*".repeat(8)}${nik.slice(12)}`;
}

/** `085987654321` -> `0859****4321`. Numbers under 9 digits never leak: returns `****`. */
export function maskWhatsapp(wa: string): string {
  if (wa.length < 9) return "****";
  return `${wa.slice(0, 4)}****${wa.slice(-4)}`;
}
