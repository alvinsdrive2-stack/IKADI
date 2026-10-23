# TEAM.md — Kontrak kerja

## Stack (fixed)
Next.js 16.4.3 App Router, TypeScript strict, Tailwind CSS v4 (`@import "tailwindcss"` di app/globals.css), Prisma + MySQL 8, Zod, React Hook Form, Argon2id (`argon2`), session cookie `iron-session`.

Next config AKTIF: `cacheComponents: true`, `partialPrefetching: true`, `experimental.agentFeedback: true`. Baca `node_modules/next/dist/docs/` sebelum nulis kode. `cookies()`/`headers()`/`searchParams` WAJIB di dalam `<Suspense>` atau pakai `'use cache: private'`; kalau perlu, `export const instant = false` di page yang baca session.

## File ownership (JANGAN nulis di luar punya sendiri)

| Agent | Boleh sentuh |
|---|---|
| backend-dev | `prisma/**`, `lib/**`, `app/api/**`, `.env.example`, `scripts/**`, `proxy.ts` |
| frontend-dev | `app/layout.tsx`, `app/globals.css`, `app/page.tsx`, `app/daftar/**`, `app/admin/**`, `components/**` |
| uiux | `docs/DESIGN.md`, `docs/mockup/*.html` (statis, read-only referensi) |
| qa-engineer | `tests/**`, `scripts/verify/**` |

## Kontrak API (backend bikin, frontend konsumsi)

- `POST /api/participants` → body JSON field form; 201 `{ok:true}`; 409 `{ok:false, code:'NIK_DUPLICATE', message:'NIK ini sudah terdaftar. Silakan hubungi admin jika membutuhkan bantuan.'}`; 400 `{ok:false, code:'VALIDATION', errors:{field:msg}}`; 429 rate limit `{ok:false, code:'RATE_LIMIT'}`.
- `POST /api/admin/login` → `{username, password}`; 200 set cookie `ikadi_admin` HttpOnly SameSite=Lax Secure di prod; 401 `{ok:false, message}`.
- `POST /api/admin/logout` → 200 clear cookie.
- `GET /api/admin/participants?q=&originType=PW|PD&originName=&education=&sermon=&dateFrom=&dateTo=&sort=newest|oldest|name_asc|name_desc&page=1&perPage=20` → `{ok:true, data:[...], total, page, perPage, totalPages}`. `nikMasked` di list (format `3576********6002`). 401 tanpa session.
- `GET /api/admin/participants/[id]` → detail full NIK. 401 tanpa session, 404.
- `GET /api/admin/stats` → `{total, pw, pd, today}`.

## Field peserta (Zod di `lib/schema.ts`, dipakai client & server)
originType PW|PD, originName, fullName, nik (strip satu `'` awal, lalu `^[0-9]{16}$`), birthPlace, birthDate (`YYYY-MM-DD`, tidak masa depan), address, whatsapp (string, strip `'` awal, `/^(\+62|62|0)8[0-9]{7,13}$/`), lastEducation?, occupation, expertise?, sermonExperience SERING|KADANG_KADANG|BELUM_PERNAH|LAINNYA (+sermonExperienceOther wajib jika LAINNYA, selain itu strip), organizationExperience?, quranReading TAJWID_BAIK|BIASA|TIDAK_LANCAR, trainingReason, trainingExpectation, consent (harus true).

## Desain
Palet & tipografi dari PRD section 9. `docs/DESIGN.md` hasil uiux sumber kebenaran token.
