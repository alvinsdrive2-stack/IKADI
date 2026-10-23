# DESIGN.md — Pendataan KTA IKADI

Sumber kebenaran token desain. Mockup: `docs/mockup/*.html` (referensi statis, bukan kode produksi). Target aksesibilitas **WCAG 2.2 AA**.

---

## 0. Siapa penggunanya

**Peserta** — ustaz/ustazah mubaligh yang mendaftar pelatihan KTA/Dai. Banyak yang membuka lewat ponsel, sebagian tidak terbiasa formulir web, sering mengisi sambil memegang KTP (menyalin NIK 16 digit). Yang mereka butuh: tidak ada kejutan, tidak ada data hilang, tombol besar, label jelas. Hindari istilah teknis ("field", "input", "submit") di UI.

**Admin** — 1–3 pengurus IKADI. Kerja di laptop, memeriksa data bertahap, butuh cari cepat, menyalin nomor WA, melihat detail satu klik.

---

## 1. Token

### 1.1 Warna (Tailwind v4 `@theme` di `app/globals.css`)

```css
@theme {
  --color-primary:        #166534; /* aksi utama, teks brand */
  --color-primary-hover:  #14532D;
  --color-primary-soft:   #DCFCE7; /* latar badge/alert sukses */
  --color-primary-ink:    #14532D; /* teks di atas primary-soft, 8.8:1 */
  --color-bg:             #F0FDF4;
  --color-surface:        #FFFFFF;
  --color-accent:         #D4AF37; /* dekoratif: garis, ornamen, ikon */
  --color-accent-soft:    #FBF5DE;
  --color-accent-ink:     #7A5C0A; /* teks emas tua di accent-soft, 5.6:1 */
  --color-ink:            #1F2937;
  --color-ink-muted:      #4B5563; /* 8.6:1 di putih */
  --color-border:         #D1D5DB; /* garis pemisah dekoratif saja */
  --color-control-border: #6B7280; /* border input/radio/checkbox, 4.6:1 — WCAG 1.4.11 */
  --color-danger:         #B91C1C;
  --color-danger-soft:    #FEF2F2;
  --color-danger-border:  #FCA5A5;
  --color-focus:          #1D4ED8;
}
```

- **Merah hanya untuk error.** Hijau untuk aksi utama dan status sukses.
- Emas tidak dipakai untuk teks kecil di atas putih (kontras ~2:1, gagal 1.4.3). Emas hanya garis, ornamen, atau `accent-ink` di atas `accent-soft`.
- `--color-border` (#D1D5DB) hanya 1.5:1 → **jangan** jadi batas satu-satunya input. Batas kontrol pakai `control-border`.
- Hapus blok `prefers-color-scheme: dark` di `app/globals.css`. Dark mode tidak dibutuhkan.
- Makna tidak boleh warna saja: badge selalu bertulisan, error selalu berikon + teks.

### 1.2 Tipografi

```css
@theme { --font-sans: var(--font-plus-jakarta), ui-sans-serif, system-ui, sans-serif; }
```
`next/font/google`: `Plus_Jakarta_Sans({ variable: "--font-plus-jakarta", subsets: ["latin"], weight: ["400","500","600","700"], display: "swap" })`.

| Token | Kelas | px/lh | Pakai |
|---|---|---|---|
| Display | `text-3xl md:text-4xl font-bold tracking-tight` | 30–36/1.15 | H1 landing |
| H1 | `text-2xl font-bold` | 24/1.3 | Judul halaman |
| H2 | `text-lg font-semibold` | 18/1.4 | Judul kelompok form |
| H3 | `text-base font-semibold` | 16/1.5 | Judul kartu |
| Body | `text-base` | 16/1.6 | Isi |
| Small | `text-sm` | 14/1.5 | Hint, sel tabel |
| Caption | `text-xs font-semibold` | 12/1.4 | Hanya badge; teks terpanjang di UI tidak boleh 12px |
| Mono | `font-mono text-sm tabular-nums tracking-wide` | 14 | NIK, tanggal, WA |

Semua input `text-base` (16px) — input <16px memicu zoom otomatis iOS saat fokus.

### 1.3 Spacing & layout

Skala 4px (`1 2 3 4 5 6 8 10 12 16 20`).
- Antar-field form: `space-y-6`. Antar-kelompok: `space-y-10` + `border-t border-border pt-8`.
- Padding kartu `p-5 sm:p-6 lg:p-8`; halaman `px-4 sm:px-6 lg:px-8`.
- Lebar: form `max-w-3xl`, landing `max-w-5xl`, admin `max-w-7xl`.
- Grid form: 1 kolom < `md`; `md:grid-cols-2` untuk field pendek. NIK, alamat, textarea, radio grup, consent = selalu 1 kolom.

### 1.4 Radius

`rounded-sm` chip · `rounded-md` input/tombol · `rounded-lg` kartu/tabel · `rounded-xl` kartu utama.

### 1.5 Shadow

- `--shadow-card: 0 1px 2px rgb(0 0 0/.04), 0 1px 3px rgb(0 0 0/.06)` → kartu.
- `--shadow-raised: 0 4px 16px rgb(0 0 0/.08)` → sticky header setelah scroll, dropdown.
- Tidak ada shadow bertumpuk di dalam kartu.

### 1.6 Fokus (2.4.7, 2.4.13)

Satu aturan global:

```css
:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}
```

Dilarang `outline: none` / `focus:outline-none`. Di atas latar hijau tua: `focus-visible:outline-white focus-visible:outline-offset-2`. Outline biru sengaja beda dari hijau brand agar tidak tertukar dengan hover.

---

## 2. Ornamen & logo

### 2.1 Pola geometris Islami (CSS, 0 dependensi)

```css
.ornament {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Cg fill='none' stroke='%23166534' stroke-width='1'%3E%3Cpath d='M32 2 62 32 32 62 2 32z'/%3E%3Cpath d='M32 14 50 32 32 50 14 32z'/%3E%3C/g%3E%3C/svg%3E");
  background-size: 64px 64px;
  opacity: .06;
  pointer-events: none;
}
```
Varian latar hijau: `stroke='%23FFFFFF'`, opacity `.08`. Dipakai hanya di hero landing dan header kartu form, sebagai `<div aria-hidden="true" class="ornament absolute inset-0">` di dalam `relative overflow-hidden`. Jangan di belakang teks isi.

### 2.2 Placeholder logo

`components/ui/Logo.tsx`:

```tsx
export function Logo({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img"
         aria-label="Logo IKADI" className={className}>
      <rect x="1" y="1" width="46" height="46" rx="12" fill="#166534" />
      <path d="M24 7l3.6 6.4L35 15l-4.8 5.3.9 7.2L24 24.6l-7.1 2.9.9-7.2L13 15l7.4-1.6z" fill="#D4AF37" />
      <text x="24" y="41" textAnchor="middle" fontFamily="Plus Jakarta Sans,sans-serif"
            fontSize="7.5" fontWeight="700" fill="#fff" letterSpacing=".6">IKADI</text>
    </svg>
  );
}
```
Ganti logo resmi = ganti isi `<svg>`, prop tetap. Di header selalu ada teks "Pendataan KTA IKADI" di samping logo (1.1.1).

---

## 3. Komponen

Pola kelas `c-[komponen]` / `c-[komponen]--[varian]`. Tabel di bawah = kontrak visual; frontend-dev bebas menulis Tailwind langsung di komponen `components/ui/*`.

### 3.1 Button

Basis: `inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors h-11 px-5 text-base disabled:opacity-60 disabled:cursor-not-allowed`

| Varian | Kelas | Pakai |
|---|---|---|
| primary | `bg-primary text-white hover:bg-primary-hover` | Kirim Data, Masuk, Terapkan |
| secondary | `bg-white text-primary border border-primary hover:bg-bg` | Reset, Batal |
| ghost | `text-ink-muted hover:text-primary hover:bg-bg` | link kecil, tombol ikon |

- Kecil (di tabel): tambah `h-9 px-3 text-sm` — hanya di area admin desktop, `min-h-11` tetap di mobile.
- Loading: `disabled` + `aria-busy="true"`, spinner `size-4 animate-spin`, label berubah ("Mengirim…"/"Memproses…"), `min-w-40` agar lebar tidak melompat. Label lama hilang, bukan ditumpuk.
- Ponsel: `w-full sm:w-auto`.

### 3.2 Field (label + hint + error)

```html
<div class="space-y-1.5">
  <label for="nik" class="block text-sm font-medium text-ink">
    Nomor NIK KTP <span class="text-primary" aria-hidden="true">*</span>
  </label>
  <p id="nik-hint" class="text-sm text-ink-muted">16 digit angka sesuai KTP, tanpa spasi.</p>
  <input id="nik" name="nik" inputmode="numeric" autocomplete="off" required aria-required="true"
         aria-invalid="true" aria-describedby="nik-hint nik-error"
         class="h-11 w-full rounded-md border border-danger bg-danger-soft/40 px-3 text-base text-ink" />
  <p id="nik-error" class="flex items-start gap-1.5 text-sm font-medium text-danger">
    <svg aria-hidden="true" class="mt-0.5 size-4 shrink-0">…</svg>
    NIK harus 16 digit angka.
  </p>
</div>
```

- Normal: `border-control-border bg-white hover:border-ink-muted focus:border-primary`.
- Error: `border-danger bg-danger-soft/40` — border tetap ada, layout tidak bergeser.
- `aria-describedby` merujuk hint **dan** error sekaligus; elemen error baru dirender saat ada error.
- Nilai yang sudah diketik tidak boleh hilang saat submit gagal.
- Bintang wajib selalu disertai kalimat di atas form: "Kolom bertanda `*` wajib diisi."
- Placeholder bukan pengganti label. Semua kontrol punya `<label for>`.

### 3.3 RadioGroup

```html
<fieldset class="space-y-2" aria-describedby="origin-error" aria-required="true">
  <legend class="text-sm font-medium text-ink">Asal IKADI <span class="text-primary" aria-hidden="true">*</span></legend>
  <div class="grid gap-2 sm:grid-cols-2">
    <label class="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-control-border bg-white px-3
                  has-[:checked]:border-primary has-[:checked]:bg-primary-soft
                  has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2">
      <input type="radio" name="originType" value="PW" class="size-4 accent-[#166534]" />
      <span class="text-base text-ink">PW (Provinsi)</span>
    </label>
    <label …>PD (Kabupaten/Kota)</label>
  </div>
  <p id="origin-error" class="text-sm font-medium text-danger">Pilih PW atau PD.</p>
</fieldset>
```

- Label membungkus input → seluruh kartu bisa diklik (2.5.8).
- 2 opsi pendek boleh sejajar; 3+ opsi selalu vertikal (label panjang).
- Tidak ada opsi pre-selected.
- Kondisional ("Lainnya" → input teks): render input saat opsi terpilih, beri `aria-controls="sermon-other"`. Jika error validasi pada input itu, fokus dipindah ke sana.

### 3.4 Select

Native `<select>` (bukan custom). Kelas input + `appearance-none pr-10` + chevron SVG absolutm `pointer-events-none`. Opsi pertama `<option value="" disabled>Pilih pendidikan</option>`.

### 3.5 Textarea

Kelas input + `min-h-28 py-2.5 resize-y`. Hint alamat: "Desa/Kelurahan, Kecamatan, Kabupaten/Kota, Provinsi."

### 3.6 Checkbox consent

Kartu `border border-control-border rounded-md p-4 min-h-11`, checkbox `size-4 mt-0.5 accent-[#166534]`, teks `text-sm`. Error: `border-danger` + `text-danger` di bawah. Tidak boleh pre-checked.

### 3.7 Card

`rounded-lg border border-border bg-surface shadow-card p-5 sm:p-6`. Kartu utama form/landing: tambah `rounded-xl border-t-4 border-t-accent`.
Header kartu: `flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4`.

### 3.8 Badge

`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold`
- netral `bg-gray-100 text-gray-700`
- PW `bg-primary-soft text-primary-ink`
- PD `bg-accent-soft text-accent-ink`
- sukses `bg-primary-soft text-primary-ink` + ikon centang

### 3.9 Table

- Wrapper `overflow-x-auto rounded-lg border border-border bg-surface`, `role="region" aria-label="Tabel data peserta" tabindex="0"` — region fokus agar bisa digulir dengan keyboard (2.1.1).
- `<table class="w-full min-w-[1000px] text-left text-sm">`
- `<thead class="bg-gray-50">` `<th scope="col" class="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">`
- `<tr class="border-t border-border hover:bg-bg/60">`, `<td class="px-4 py-3">`
- NIK, tanggal, WA: `font-mono tabular-nums whitespace-nowrap`.
- Urutkan: `<th aria-sort="none|ascending|descending">` + tombol di dalam header.
- Mobile: tetap tabel dengan scroll horizontal, **bukan** berubah jadi kartu. Scroll container diberi gradient tepi kanan sebagai petunjuk isi terpotong (dekoratif).

### 3.10 Pagination

```html
<nav aria-label="Navigasi halaman" class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
  <p class="text-sm text-ink-muted">Menampilkan 1–20 dari 137 peserta</p>
  <div class="flex items-center gap-2">
    <span aria-disabled="true" class="…opacity-50 px-3 h-10 inline-flex items-center rounded-md border">← Sebelumnya</span>
    <span class="text-sm text-ink-muted">Halaman <strong>2</strong> dari 7</span>
    <a href="?page=3" class="…px-3 h-10 inline-flex items-center rounded-md border border-control-border">Berikutnya →</a>
  </div>
</nav>
```
Nonaktif = `<span aria-disabled="true" aria-label="Halaman sebelumnya, tidak tersedia">`, bukan `href="#"`. Halaman aktif `aria-current="page"`.

### 3.11 Empty state

`flex flex-col items-center text-center gap-3 py-14 px-4`. Ikon garis 48px (`aria-hidden`), judul `h3 text-base font-semibold`, deskripsi `text-sm text-ink-muted max-w-sm`, tombol secondary "Reset filter" (hanya varian `filtered`).

### 3.12 Alert

- Sukses: `<div role="status" class="rounded-md border border-primary/20 bg-primary-soft p-4 text-primary-ink">`
- Error: `<div role="alert" class="rounded-md border border-danger-border bg-danger-soft p-4 text-danger">`
- Selalu ikon + teks. Tombol tutup opsional, `aria-label="Tutup notifikasi"`.
- Error global form (NIK duplikat, rate limit) dirender **di dalam form, tepat di atas tombol Kirim**, tidak di pojok layar.

### 3.13 StatCard

`Card p-5`; label `text-sm text-ink-muted`; angka `text-3xl font-bold tabular-nums text-ink`. Grid `grid-cols-2 lg:grid-cols-4 gap-4`. Nilai 0 tetap tampil "0", bukan "—".

### 3.14 ErrorSummary

`<div role="alert" tabIndex={-1} class="rounded-md border-2 border-danger bg-danger-soft p-4">` → `<h2 class="text-base font-semibold text-danger">Ada <em>N</em> isian yang perlu diperbaiki</h2>` → `<ul>` tautan `href="#fieldId"` dengan teks **persis sama** dengan pesan inline. Ditempatkan paling atas di dalam `<form>`, di atas `<h1>`. Fokus dipindah ke sini saat submit gagal. Pola GOV.UK Error Summary.
---

## 4. Halaman & state

### 4.1 `/` Landing
Header: logo + "Pendataan KTA IKADI" + link ghost kecil "Masuk Admin" di kanan.
Hero (latar hijau tua + ornamen putih tipis): H1 "Pendataan Kartu Tanda Anggota IKADI", satu kalimat "Lengkapi data diri Anda untuk pendataan KTA IKADI.", tombol **"Isi Formulir"** dengan `bg-white text-primary-hover` (putih di hijau 6.5:1; tombol hijau di atas hijau gagal 1.4.11).
Tiga kartu ringkas: "Isi satu kali per NIK", "Data hanya dilihat admin", "Bisa diisi dari ponsel".
Footer: kontak pengelola (placeholder) + "Data NIK Anda tidak ditampilkan kepada publik."

### 4.2 `/daftar`
Kelompok (fieldset + legend):
1. **Identitas** — Asal IKADI, Nama PW/PD IKADI, Nama Lengkap & Gelar, NIK
2. **Data Pribadi** — Tempat Lahir, Tanggal Lahir, Alamat, No. WhatsApp
3. **Latar Belakang** — Pendidikan Terakhir, Pekerjaan, Bidang Keahlian
4. **Pengalaman** — Pengalaman Khutbah, Organisasi (jabatan), Kemampuan Al-Qur'an
5. **Motivasi** — Alasan Mengikuti Pelatihan, Harapan Setelah Pelatihan
6. **Persetujuan** — checkbox privasi

| State | Tampilan |
|---|---|
| default | form kosong, tombol aktif |
| validasi gagal | ErrorSummary di atas h1, fokus ke summary, border merah per field |
| sedang kirim | tombol disabled "Mengirim...", `aria-busy` pada form, input tetap aktif |
| NIK duplikat | Alert error di atas tombol Kirim, fokus ke alert, field NIK `aria-invalid` |
| rate limit | Alert error "Terlalu banyak percobaan. Tunggu satu menit lalu coba lagi." |
| sukses | redirect `/daftar/sukses` (bukan modal) |
| jaringan gagal | Alert error; semua isian tetap |

Validasi saat submit, lalu re-validasi field yang sudah error saat diubah. Jangan validasi saat menaip di field bersih (mengganggu pengguna lambat — pola GOV.UK).

### 4.3 `/daftar/sukses`
Ikon centang besar di lingkaran `bg-primary-soft`, H1 "Data berhasil dikirim.", paragraf "Terima kasih. Data Anda sudah kami terima dan akan diperiksa admin IKADI.", tombol secondary "Kembali ke beranda". h1 `tabIndex={-1}` difokus saat mount.

### 4.4 `/admin/login`
Kartu `max-w-md mx-auto`. H1 "Masuk Admin". Field "Username" (`autocomplete="username"`) + "Sandi" (`type="password"`, `autocomplete="current-password"`). Tombol primary full-width "Masuk". Error `role="alert"` "Email/Username atau sandi salah." (pesan sama untuk kedua penyebab). Loading: "Memproses...".

### 4.5 `/admin` Dashboard
Topbar: logo + "Pendataan KTA IKADI" + badge "Admin" + tombol ghost "Keluar". Topbar, bukan sidebar — tabel lebar butuh ruang.
Lalu: 4 StatCard, lalu Card filter, lalu Card tabel + pagination.
- Search `input type="search"`, label "Cari peserta", placeholder "Nama, NIK, atau No. WA".
- Filter: Asal IKADI, Nama PW/PD, Pendidikan, Pengalaman Khutbah, Tanggal (dari–sampai). Grid `md:grid-cols-2 lg:grid-cols-4`.
- Tombol "Terapkan" (primary) + "Reset" (secondary). Filter hanya jalan saat Terapkan/Enter, tidak saat select berubah (3.2.2).
- Filter aktif = chip di atas tabel + "Hapus semua".
- Mobile: filter di dalam `details` + `summary` `min-h-11` "Filter (2)".
- State: loading (skeleton 5 baris, `aria-busy="true"`), error ("Gagal memuat data." + "Coba lagi"), empty (3.11), data.

### 4.6 `/admin/peserta/[id]`
Halaman penuh (bisa dibookmark, dibagikan antar-admin), **bukan** drawer/modal.
Tautan "← Kembali ke daftar" di atas (target ≥44px). H1 = nama peserta. Banner tipis `bg-accent-soft text-accent-ink`: "NIK bersifat pribadi. Jangan bagikan tangkapan layar halaman ini."
`dl` dengan `grid gap-x-8 gap-y-5 md:grid-cols-2`, tiap `dt` `text-sm text-ink-muted` + `dd` `text-base text-ink`. NIK & WA `font-mono` + tombol "Salin" dengan konfirmasi `aria-live="polite"` "Disalin."

---

## 5. Microcopy

### 5.1 Validasi per field
| Field | Pesan |
|---|---|
| Asal IKADI | Pilih PW atau PD. |
| Nama PW/PD IKADI | Nama PW/PD IKADI wajib diisi. |
| Nama Lengkap | Nama lengkap wajib diisi. |
| NIK — kosong | NIK wajib diisi. |
| NIK — format | NIK harus 16 digit angka. |
| NIK — duplikat | NIK ini sudah terdaftar. Silakan hubungi admin jika membutuhkan bantuan. |
| Tempat Lahir | Tempat lahir wajib diisi. |
| Tanggal Lahir — kosong | Tanggal lahir wajib diisi. |
| Tanggal Lahir — masa depan | Tanggal lahir tidak boleh melewati hari ini. |
| Alamat | Alamat wajib diisi. |
| No. WA — kosong | Nomor WhatsApp wajib diisi. |
| No. WA — format | Nomor WhatsApp tidak valid. Contoh: 085987654321. |
| Pekerjaan | Pekerjaan wajib diisi. |
| Pengalaman Khutbah | Pilih pengalaman khutbah Anda. |
| Pengalaman Khutbah — Lainnya kosong | Jelaskan pengalaman khutbah Anda. |
| Kemampuan Al-Qur'an | Pilih kemampuan membaca Al-Qur'an Anda. |
| Alasan Mengikuti Pelatihan | Alasan mengikuti pelatihan wajib diisi. |
| Harapan Setelah Pelatihan | Harapan setelah pelatihan wajib diisi. |
| Persetujuan | Centang persetujuan untuk melanjutkan. |

Pendidikan, Bidang Keahlian, Pengalaman Organisasi opsional, tanpa pesan. Jangan pakai "Field ini tidak valid" / "Input tidak sesuai".

### 5.2 Status global
- Sukses: **"Data berhasil dikirim."**
- Rate limit: "Terlalu banyak percobaan. Tunggu satu menit lalu coba lagi."
- Jaringan: "Koneksi bermasalah. Data belum terkirim — periksa internet lalu coba lagi."
- Server 500: "Maaf, terjadi kendala di server. Coba lagi beberapa saat."
- Login gagal: "Email/Username atau sandi salah."
- Sesi habis: "Sesi Anda berakhir. Silakan masuk kembali."

### 5.3 Empty state
- Hasil filter kosong: judul **"Tidak ada data yang cocok."**, isi "Coba ubah kata kunci atau filter yang dipakai.", tombol **"Reset filter"**.
- Belum ada data: "Belum ada peserta yang mendaftar." / "Data akan muncul di sini setelah peserta mengirim formulir."

### 5.4 Privasi & persetujuan
Di bawah H1 form:
> Data yang Anda isi digunakan IKADI untuk pendataan dan pengurusan Kartu Tanda Anggota. NIK Anda hanya dapat dilihat oleh admin dan tidak ditampilkan kepada publik.

Checkbox:
> Saya memahami data yang saya isi digunakan untuk pendataan KTA IKADI dan saya dapat dihubungi melalui nomor WhatsApp yang dicantumkan.

Hint NIK: "16 digit angka sesuai KTP, tanpa spasi."
Hint WA: "Contoh: 085987654321 atau +6285987654321."

### 5.5 Label tombol (konsisten)
"Isi Formulir" · "Kirim Data" · "Mengirim..." · "Masuk" · "Terapkan" · "Reset" · "Reset filter" · "Detail" · "Kembali ke daftar" · "Keluar" · "Salin".

---

## 6. Aksesibilitas — checklist

- **2.4.7 / 2.4.13** focus ring global 2px biru, offset 2px, tidak terpotong `overflow-hidden`; tidak ada `outline-none`.
- **1.4.11** border kontrol `control-border` 4.6:1; border dekoratif bukan batas kontrol.
- **1.4.3** kontras teks ≥4.5:1 (ink 13.3:1, ink-muted 8.6:1, primary di putih 6.5:1, danger 6.4:1, accent-ink di accent-soft 5.6:1).
- **3.3.1 / 3.3.2 / 3.3.3** error berupa teks + ikon; setiap kontrol punya label; pesan menyebut contoh format.
- **3.2.2** filter admin tidak auto-submit saat memilih opsi.
- **3.2.1** tidak ada data hilang saat submit gagal.
- **2.4.3** urutan DOM = urutan visual; fokus pindah ke ErrorSummary saat submit gagal.
- **4.1.3** sukses `role="status"`, error `role="alert"`.
- **2.5.8** target ≥44px (`min-h-11`).
- **2.1.1** tabel di region `tabindex="0"`; `details` untuk filter mobile.
- **1.3.1** satu h1 per halaman; kontrol dikelompokkan fieldset + legend.
- **1.1.1** logo `role="img" aria-label`; ornamen `aria-hidden`.
- **Tanpa warna** semua status tetap terbaca (teks badge, ikon + teks error, `aria-current`).

---

## 7. Yang sengaja tidak dibuat

Dark mode (biaya QA kontras, belum diminta) · drawer/modal detail (halaman penuh bisa dibookmark dan diakses keyboard) · toast floating (alert inline lebih pasti diumumkan) · ikon library (SVG inline) · custom select (native lebih andal di ponsel) · tombol tampilkan sandi (bukan kebutuhan MVP) · validasi saat menaip (mengganggu pengguna lambat).

---

## 8. Daftar komponen untuk frontend-dev

`components/ui/`:
1. `Button` — primary/secondary/ghost, `loading`
2. `Field` — label + hint + error + wiring aria, props `{id,label,hint?,error?,required?,children}`
3. `Input`, `Textarea`, `Select` — dibungkus `Field`
4. `RadioGroup` — `{legend,hint?,error?,name,options,reveal?}`
5. `Checkbox` — varian kartu consent
6. `Card`, `StatCard`
7. `Badge` — netral/pw/pd/sukses
8. `Alert` — `{variant:'success'|'error'}`
9. `ErrorSummary` — `{errors:{id,message}[]}`
10. `DataTable` — region scroll + `aria-sort` + slot kolom
11. `Pagination`
12. `EmptyState` — `{variant:'filtered'|'empty'}`
13. `Logo`

`components/` (layout & fitur):
14. `SiteHeader`, `SiteFooter`
15. `AdminHeader`
16. `ParticipantForm` (RHF + Zod, ErrorSummary, submit/loading/duplikat)
17. `ParticipantFilters` (search + 5 filter + Terapkan/Reset + chip aktif)
18. `ParticipantDetail` (dl, salin NIK, banner privasi)

---

## 9. Mockup statis

`docs/mockup/` — HTML self-contained (Tailwind CDN + token inline), bukan kode produksi:

| File | Isi |
|---|---|
| `landing.html` | Hero, 3 kartu manfaat, footer |
| `daftar.html` | Form lengkap + contoh error inline NIK + alert duplikat |
| `admin-login.html` | Kartu login + state error |
| `admin-dashboard.html` | Topbar, 4 stat, filter, chip aktif, tabel 8 baris, pagination |
| `admin-detail.html` | Detail peserta, banner privasi, salin NIK |

Yang **belum** ada mockup: `/daftar/sukses` (spesifikasi di 4.3), empty state dashboard (3.11), loading skeleton. Ikuti spesifikasi teks di atas.
