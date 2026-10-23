// AC-01 (responsive markers) and AC-12 (empty state + reset) plus design-token sync
// against docs/DESIGN.md. Static source checks only - no browser.
// Run: npm run verify:qa
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

function walk(dir: string): string[] {
  const abs = path.join(root, dir);
  return readdirSync(abs).flatMap((name) => {
    const rel = path.join(dir, name);
    return statSync(path.join(root, rel)).isDirectory() ? walk(rel) : [rel];
  });
}

const tsxFiles = [...walk("app"), ...walk("components")].filter((f) => f.endsWith(".tsx"));
const globals = read("app/globals.css");

test("DESIGN 1.1: token warna di app/globals.css sama persis dengan DESIGN.md", () => {
  const expected: Record<string, string> = {
    "--color-primary": "#166534",
    "--color-primary-hover": "#14532d",
    "--color-primary-soft": "#dcfce7",
    "--color-primary-ink": "#14532d",
    "--color-bg": "#f0fdf4",
    "--color-surface": "#ffffff",
    "--color-accent": "#d4af37",
    "--color-accent-soft": "#fbf5de",
    "--color-accent-ink": "#7a5c0a",
    "--color-ink": "#1f2937",
    "--color-ink-muted": "#4b5563",
    "--color-border": "#d1d5db",
    "--color-control-border": "#6b7280",
    "--color-danger": "#b91c1c",
    "--color-focus": "#1d4ed8",
  };
  for (const [token, hex] of Object.entries(expected)) {
    const actual = globals.match(new RegExp(`${token}:\\s*(#[0-9a-fA-F]{6})`))?.[1].toLowerCase();
    assert.equal(actual, hex, `${token} harus ${hex}`);
  }
});

test("DESIGN 1.1: dark mode dihapus, font Plus Jakarta Sans dipakai", () => {
  assert.ok(!globals.includes("prefers-color-scheme"), "tidak boleh ada blok dark mode");
  assert.match(globals, /--font-sans:\s*var\(--font-plus-jakarta\)/);
  assert.match(read("app/layout.tsx"), /Plus_Jakarta_Sans/);
});

test("DESIGN 1.6: outline-none hanya di kontrol yang punya pengganti fokus eksplisit", () => {
  assert.match(globals, /:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--color-focus\)/);
  const offenders: string[] = [];
  for (const f of tsxFiles) {
    read(f)
      .split("\n")
      .forEach((line, i) => {
        if (!/outline-none/.test(line)) return;
        if (/focus:border-primary|focus-visible:outline/.test(line)) return;
        offenders.push(`${f}:${i + 1}`);
      });
  }
  assert.deepEqual(offenders, [], "outline-none tanpa pengganti fokus = WCAG 2.4.7 gagal");
});

test("tidak ada kelas token yang tidak didefinisikan (mis. border-line)", () => {
  const offenders: string[] = [];
  for (const f of tsxFiles) {
    read(f)
      .split("\n")
      .forEach((line, i) => {
        if (/\bborder-line\b/.test(line)) offenders.push(`${f}:${i + 1}`);
      });
  }
  assert.deepEqual(offenders, [], "border-line tidak ada di @theme; gunakan border-border");
});

test("DESIGN 1.1: border dekoratif tidak dipakai sebagai batas kontrol input", () => {
  const offenders: string[] = [];
  for (const f of tsxFiles) {
    read(f)
      .split("\n")
      .forEach((line, i) => {
        if (/border-border/.test(line) && /<(input|select|textarea)\b/.test(line)) offenders.push(`${f}:${i + 1}`);
        if (/border-border/.test(line) && /controlState|controlClass/.test(line)) offenders.push(`${f}:${i + 1}`);
      });
  }
  assert.deepEqual(offenders, []);
});

test("DESIGN 1.2: input 16px (text-base) di komponen kontrol", () => {
  const field = read("components/Field.tsx");
  assert.match(field, /controlClass[\s\S]*?text-base/);
  // text-sm yang menempel di kelas kontrol = input <16px = zoom iOS. text-sm di label/hint sah.
  // Text input/select/textarea only (DESIGN 1.2). Checkbox consent p-4 text-sm is allowed (3.6).
  const controlLines = field.split(/\n/).filter((l) => /\bw-full rounded-md border\b/.test(l));
  assert.ok(controlLines.length > 0, "kelas kontrol harus ketemu");
  for (const l of controlLines) assert.ok(!/text-sm/.test(l), `kontrol <16px: ${l.trim()}`);
});

test("AC-01: form peserta punya layout responsif (grid 1 kolom di mobile)", () => {
  const form = read("components/ParticipantForm.tsx");
  // Field pendek boleh 2 kolom hanya dari sm/md ke atas (grid tanpa prefix = 2 kolom di ponsel).
  const grids = form.match(/grid gap-\d+ [^"]*grid-cols-2[^"]*/g) ?? [];
  assert.ok(grids.length > 0, "harus ada grid 2 kolom untuk field pendek");
  for (const g of grids) assert.match(g, /\b(sm|md|lg):grid-cols-2/, `grid tanpa breakpoint: ${g}`);

  // Item dengan lebar > 390px adalah penyebab overflow di ponsel. NIK/alamat/radio wajib full-width.
  const wideFixed = tsxFiles.flatMap((f) =>
    (read(f).match(/[^"]*\b(w-\[\d{3,}px\]|min-w-\[(?:[4-9]\d{2}|\d{4,})px\])\b[^"]*/g) ?? []).map((s) => `${f}: ${s}`),
  ).filter((s) => !/min-w-\[1000px\]/.test(s)); // tabel admin: scroll horizontal, disengaja (DESIGN 3.9)
  assert.deepEqual(wideFixed, [], "lebar px tetap >390px memaksa scroll horizontal di ponsel");
});

test("AC-01: halaman admin/form pakai padding responsif, bukan max-w tetap", () => {
  for (const page of ["app/daftar/page.tsx", "app/admin/layout.tsx", "app/page.tsx"]) {
    const src = read(page);
    assert.match(src, /max-w-(2xl|3xl|4xl|5xl|6xl|7xl)/, `${page} butuh batas lebar konten`);
    assert.match(src, /(px-4|p-4|sm:p-6)/, `${page} butuh padding mobile`);
  }
});

test("AC-12: empty state dashboard menampilkan pesan + tombol Reset filter", () => {
  const src = read("components/AdminParticipants.tsx");
  assert.match(src, /<EmptyState/);
  assert.match(src, /Reset filter/);
  assert.match(src, /list\.data\.length === 0/, "empty state hanya saat data kosong");
  assert.match(src, /const resetAll = \(\) => router\.(push|replace)\("\/admin"\)/, "reset harus menghapus semua query filter");
  const empty = read("components/EmptyState.tsx");
  assert.match(empty, /<h3/);
  assert.match(empty, /aria-hidden/, "ikon dekoratif harus aria-hidden");
});

test("DESIGN 3.9: tabel admin ada di region yang bisa difokus keyboard", () => {
  const src = read("components/AdminParticipants.tsx");
  assert.match(src, /aria-label="Tabel data peserta"/);
  assert.match(src, /tabIndex=\{0\}/);
  assert.match(src, /overflow-x-auto/);
});

test("DESIGN 1.1: tidak ada hex warna mentah di luar globals.css & Logo", () => {
  const allowed = new Set([path.join("components", "Logo.tsx")]);
  const offenders: string[] = [];
  for (const f of tsxFiles) {
    if (allowed.has(f)) continue;
    read(f)
      .split("\n")
      .forEach((line, i) => {
        // accent-[#166534] in the consent checkbox violates the token rule too.
        for (const m of line.matchAll(/#[0-9a-fA-F]{6}\b/g)) offenders.push(`${f}:${i + 1} ${m[0]}`);
      });
  }
  assert.deepEqual(offenders, [], "pakai token (bg-primary) bukan hex");
});

test("DESIGN 3.6 / 4.2: checkbox consent tidak pre-checked", () => {
  const form = read("components/ParticipantForm.tsx");
  assert.match(form, /consent: false/);
  assert.ok(!/defaultChecked/.test(form));
});
