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
    "--color-primary": "#04a94b",
    "--color-primary-hover": "#037a37",
    "--color-primary-soft": "#e6f5ec",
    "--color-primary-ink": "#036b32",
    "--color-bg": "#f7f9f0",
    "--color-surface": "#ffffff",
    "--color-accent": "#f5b800",
    "--color-accent-soft": "#fff4d6",
    "--color-accent-ink": "#7a5c0a",
    "--color-ink": "#1a2e22",
    "--color-ink-muted": "#4b5a50",
    "--color-border": "#d9e2d8",
    "--color-control-border": "#8a9a8e",
    "--color-danger": "#b42318",
    "--color-focus": "#04a94b",
  };
  for (const [token, hex] of Object.entries(expected)) {
    const actual = globals.match(new RegExp(`${token}:\\s*(#[0-9a-fA-F]{6})`))?.[1].toLowerCase();
    assert.equal(actual, hex, `${token} harus ${hex}`);
  }
});

test("DESIGN 1.1: dark mode dihapus, font Plus Jakarta Sans dipakai", () => {
  assert.ok(!globals.includes(".dark"), "tidak boleh ada blok dark mode");
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
  // Kontrol sekarang tinggal di primitif components/ui/*; Field hanya membungkus.
  for (const f of ["components/ui/input.tsx", "components/ui/textarea.tsx", "components/ui/select.tsx"]) {
    const src = read(f);
    assert.match(src, /text-base/, `${f} harus text-base (hindari zoom iOS)`);
    assert.ok(!/text-sm/.test(src), `${f} tidak boleh text-sm di kontrol`);
  }
  // Checkbox consent p-4 text-sm sah (DESIGN 3.6).
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
  // Halaman publik & form membungkus konten lewat shell (SiteChrome/AppFrame/AuthShell).
  const shell = read("components/layout/AuthShell.tsx");
  assert.match(shell, /max-w-/, "AuthShell butuh batas lebar konten");
  assert.match(shell, /px-4/, "AuthShell butuh padding mobile");

  for (const page of ["app/daftar/page.tsx"]) {
    const src = read(page);
    assert.match(src, /<AuthShell/, `${page} harus pakai AuthShell`);
  }

  const frame = read("components/AppFrame.tsx");
  assert.match(frame, /max-w-/, "AppFrame butuh batas lebar konten");
  assert.match(frame, /px-4/, "AppFrame butuh padding mobile");

  const landing = read("app/page.tsx");
  assert.match(landing, /max-w-/, "landing butuh batas lebar konten");
  assert.match(landing, /px-4/, "landing butuh padding mobile");
});

test("AC-12: empty state dashboard menampilkan pesan + tombol Reset filter", () => {
  const src = read("components/AdminParticipants.tsx");
  assert.match(src, /<EmptyState/);
  assert.match(src, /Reset filter/);
  assert.match(src, /list\.data\.length === 0/, "empty state hanya saat data kosong");
  assert.match(src, /const resetAll = \(\) => router\.(push|replace)\("\/admin\/peserta"\)/, "reset harus menghapus semua query filter");
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
