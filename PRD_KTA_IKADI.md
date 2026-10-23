# Product Requirements Document (PRD)

## Pendataan KTA IKADI — MVP Tahap 1

**Versi:** 1.0  
**Status:** Draft pengembangan  
**Stack:** Next.js (App Router), TypeScript, MySQL, Prisma ORM, Tailwind CSS  
**Fokus tahap ini:** Input data oleh peserta dan monitoring data oleh admin.

## 1. Ringkasan

Aplikasi web pendataan KTA IKADI memungkinkan peserta mengisi formulir data diri secara mandiri. Admin dapat login ke halaman monitoring untuk melihat, mencari, memfilter, dan memeriksa data peserta yang masuk.

**Batasan MVP:** Belum mencakup pencetakan KTA, pembayaran, verifikasi dokumen, unggah foto, pengiriman WhatsApp, manajemen pelatihan, ataupun workflow persetujuan berjenjang.

## 2. Tujuan

1. Memudahkan peserta mengirim data melalui satu formulir web yang responsif.
2. Menyimpan data secara terstruktur dalam MySQL.
3. **Mencegah NIK yang sama tersimpan lebih dari satu kali**, termasuk saat dua pengguna mengirim bersamaan.
4. Memudahkan admin melakukan monitoring, pencarian, dan filter data.
5. Menyajikan tampilan bernuansa Islami yang bersih, dengan dominasi hijau dan placeholder logo IKADI.

## 3. Peran Pengguna

| Peran | Hak akses |
|---|---|
| Peserta | Membuka halaman formulir publik dan mengirim data, tanpa login |
| Admin | Login, melihat daftar peserta, mencari, memfilter, membuka detail, dan melihat ringkasan data |

**Catatan:** Peserta tidak dapat mengakses daftar peserta lain. Data NIK lengkap hanya dapat diakses oleh admin yang sudah terautentikasi.

## 4. Ruang Lingkup Fitur

### 4.1 Formulir peserta

- Form satu halaman, dibagi menjadi beberapa kelompok agar mudah dibaca.
- Label jelas; kolom wajib ditandai `*`.
- Validasi langsung pada input dan validasi ulang di server.
- Tombol **Kirim Data** dengan loading state dan pencegahan double-submit di UI.
- Pesan sukses setelah data benar-benar tersimpan.
- Jika NIK sudah terdaftar, tampilkan pesan tanpa membocorkan identitas pemiliknya: **“NIK ini sudah terdaftar. Silakan hubungi admin jika membutuhkan bantuan.”**
- Tidak menyediakan fitur edit mandiri pada tahap ini.

### 4.2 Login admin

- Halaman login khusus admin (email/username dan password).
- Password disimpan dalam bentuk hash yang aman (contoh: Argon2id).
- Session aman menggunakan cookie `HttpOnly`, `Secure` saat HTTPS, dan `SameSite`.
- Semua halaman dan API admin memeriksa otorisasi di server.
- Akun admin dibuat melalui seed/script internal; belum perlu antarmuka manajemen admin.

### 4.3 Dashboard monitoring admin

- Kartu ringkasan: **Total peserta**, **Jumlah PW**, **Jumlah PD**, dan **Peserta masuk hari ini**.
- Tabel data dengan kolom: No., Tanggal Input, Nama Lengkap, NIK (disamarkan pada tabel), Asal IKADI, Nama PW/PD IKADI, No. WA, Pendidikan Terakhir, dan Aksi **Detail**.
- Cari berdasarkan nama, NIK, atau nomor WA. Pencarian NIK lengkap tersedia hanya untuk admin.
- Filter berdasarkan **Asal IKADI (PW/PD)**, **Nama PW/PD IKADI**, **Pendidikan Terakhir**, **Pengalaman Khutbah**, dan **Rentang tanggal input**.
- Sort berdasarkan tanggal input (terbaru/terlama) dan nama.
- Pagination server-side (default 10 atau 20 baris per halaman).
- Halaman/detail drawer untuk melihat seluruh isian peserta.
- Empty state ketika tidak ada hasil; opsi reset filter.

**Tidak termasuk MVP:** Edit/hapus data admin, ekspor Excel/CSV, grafik lanjutan, cetak KTA, notifikasi, dan approval data.

## 5. Spesifikasi Formulir

| No. | Field | Komponen | Wajib | Aturan |
|---:|---|---|:---:|---|
| 1 | Asal IKADI | Radio/select | Ya | Pilihan: `PW (Provinsi)` atau `PD (Kabupaten/Kota)` |
| 2 | Nama PW/PD IKADI | Input teks | Ya | Isi nama wilayah/unit sesuai pilihan Asal IKADI; trim spasi |
| 3 | Nama Lengkap & Gelar/Akademik | Input teks | Ya | Nama dan gelar dapat ditulis dalam satu kolom |
| 4 | Nomor NIK KTP | Input teks | Ya | **Tepat 16 digit**, hanya angka, **unik** |
| 5 | Tempat Lahir | Input teks | Ya | Dipisahkan dari tanggal lahir pada UI dan database |
| 6 | Tanggal Lahir | Date picker | Ya | Tanggal valid; tidak boleh di masa depan |
| 7 | Alamat | Textarea | Ya | Petunjuk: Desa/Kelurahan, Kecamatan, Kota/Kab., Provinsi |
| 8 | No. Handphone (WA) | Input `tel` | Ya | Pertahankan awalan `0` atau `+62`, tidak diubah ke tipe angka |
| 9 | Pendidikan Terakhir | Select/input teks | Tidak | Pada MVP dapat berupa select dengan opsi `Lainnya`; dapat disepakati kemudian |
| 10 | Pekerjaan | Input teks | Ya | Trim spasi |
| 11 | Bidang Keahlian | Input teks/textarea | Tidak | Teks bebas |
| 12 | Pengalaman Khutbah | Radio + opsi lainnya | Ya | `Sering`, `Kadang-Kadang`, `Belum Pernah`, `Lainnya` (dengan teks tambahan bila dipilih) |
| 13 | Pengalaman Organisasi - Jabatan | Textarea | Tidak | Teks bebas |
| 14 | Kemampuan Membaca Al Qur'an | Radio | Ya | `Baik Sesuai Hukum Tajwid`, `Biasa Saja`, `Tidak Lancar` |
| 15 | Alasan Mengikuti Pelatihan | Textarea | Ya | Teks bebas |
| 16 | Harapan Setelah Pelatihan | Textarea | Ya | Teks bebas |

**Catatan mengenai tanda petik pada NIK/WA:** Petunjuk `'3576014241026002` dan `'085987654321` biasanya digunakan agar aplikasi spreadsheet tidak menghilangkan digit nol di depan atau mengubah angka panjang. **Dalam aplikasi ini peserta tidak perlu mengetik tanda petik `'`**, karena NIK dan WA disimpan sebagai **string**, bukan angka. Untuk memudahkan adaptasi dari formulir lama, backend boleh menghapus **satu tanda petik di awal** sebelum validasi. Jangan menyimpan tanda petiknya di database.

**Pendidikan Terakhir** serta beberapa kolom yang tidak ditandai `*` dianggap opsional mengikuti formulir yang diberikan. Opsi pendidikan awal yang disarankan: SD/Sederajat, SMP/Sederajat, SMA/SMK/Sederajat, D1/D2/D3, D4/S1, S2, S3, Lainnya.

## 6. Alur Pengguna

### Peserta

1. Membuka `/daftar`.
2. Mengisi formulir dan melihat kesalahan validasi bila ada.
3. Menekan **Kirim Data**.
4. Server menormalisasi data, memvalidasi field, dan mencoba menyimpannya.
5. Jika berhasil: tampil halaman/pesan **“Data berhasil dikirim.”**
6. Jika NIK duplikat: tampil pesan NIK sudah terdaftar, tanpa membuat baris baru.

### Admin

1. Membuka `/admin/login` dan login.
2. Masuk `/admin` untuk melihat metrik ringkasan dan tabel data.
3. Menggunakan search, filter, sort, dan pagination.
4. Memilih **Detail** untuk meninjau semua informasi peserta.
5. Logout setelah selesai.

## 7. Struktur Halaman dan Route

| Route | Akses | Fungsi |
|---|---|---|
| `/` | Publik | Landing singkat: identitas pendataan + tombol **Isi Formulir** |
| `/daftar` | Publik | Form input peserta |
| `/daftar/sukses` | Publik | Konfirmasi pengiriman berhasil |
| `/admin/login` | Publik | Login admin |
| `/admin` | Admin | Dashboard ringkasan dan tabel monitoring |
| `/admin/peserta/[id]` | Admin | Detail data peserta |

**API/server action minimum:** `POST /api/participants` (submit); `POST /api/admin/login` dan endpoint logout atau handler auth; `GET /api/admin/participants` (pencarian/filter/pagination); `GET /api/admin/participants/[id]` (detail). Implementasi boleh menggunakan Next.js Server Actions untuk operasi yang sesuai, dengan kontrol akses yang sama.

## 8. Rancangan Database MySQL

Contoh skema awal (dapat diterjemahkan menjadi model Prisma dan migration):

```sql
CREATE TABLE participants (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  origin_type ENUM('PW', 'PD') NOT NULL,
  origin_name VARCHAR(150) NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  nik VARCHAR(16) NOT NULL,
  birth_place VARCHAR(120) NOT NULL,
  birth_date DATE NOT NULL,
  address TEXT NOT NULL,
  whatsapp VARCHAR(20) NOT NULL,
  last_education VARCHAR(100) NULL,
  occupation VARCHAR(150) NOT NULL,
  expertise TEXT NULL,
  sermon_experience ENUM('SERING', 'KADANG_KADANG', 'BELUM_PERNAH', 'LAINNYA') NOT NULL,
  sermon_experience_other VARCHAR(200) NULL,
  organization_experience TEXT NULL,
  quran_reading ENUM('TAJWID_BAIK', 'BIASA', 'TIDAK_LANCAR') NOT NULL,
  training_reason TEXT NOT NULL,
  training_expectation TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_participants_nik (nik),
  INDEX idx_participants_created_at (created_at),
  INDEX idx_participants_origin (origin_type, origin_name),
  INDEX idx_participants_full_name (full_name)
);

CREATE TABLE admins (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Aturan penting keunikan NIK

- Gunakan kolom `nik VARCHAR(16) NOT NULL` dan **UNIQUE INDEX** di MySQL sebagai sumber kebenaran.
- Normalisasi input: trim whitespace, hapus satu `'` di awal jika ada, lalu periksa regex `^[0-9]{16}$`.
- Saat submit, boleh mengecek apakah NIK sudah ada untuk UX, tetapi **jangan mengandalkan pengecekan ini saja** karena ada kemungkinan request bersamaan.
- Tangkap error unique constraint dari MySQL/Prisma dan kembalikan status **HTTP 409 Conflict** dengan pesan aman.
- Jangan tampilkan NIK lengkap dalam log aplikasi atau pesan error publik.
- Nomor WhatsApp juga harus `VARCHAR`, bukan tipe numerik, tetapi **tidak harus unik**.

## 9. Desain UI / UX

**Arah visual:** Islami modern, rapi, ramah ponsel, fokus pada kemudahan pengisian.

| Elemen | Spesifikasi |
|---|---|
| Primary | Hijau tua `#166534` |
| Primary hover | `#14532D` |
| Background | Hijau sangat muda `#F0FDF4` / putih `#FFFFFF` |
| Accent | Emas lembut `#D4AF37` (gunakan secukupnya) |
| Teks | Abu-abu gelap `#1F2937` |
| Border | `#D1D5DB` |
| Font | Plus Jakarta Sans atau Inter |
| Logo | Kotak/circle placeholder bertuliskan **LOGO IKADI** yang mudah diganti file resmi |

- Header: placeholder logo IKADI, judul **Pendataan KTA IKADI**, subjudul singkat.
- Form dalam card putih berujung membulat dengan label jelas dan jarak antar-field lapang.
- Ornamen pola geometris Islami boleh dipakai secara halus pada header/background, jangan mengurangi keterbacaan.
- Warna merah hanya untuk error; hijau untuk tombol utama dan status sukses.
- Dashboard admin: sidebar/topbar sederhana, kartu statistik, filter, dan tabel horizontal-scroll di mobile.
- Minimum: responsif untuk layar ponsel, tablet, desktop; state loading, error, sukses, dan kosong.

## 10. Teknologi dan Arsitektur

- **Frontend + backend:** Next.js App Router + TypeScript.
- **Styling:** Tailwind CSS (opsional shadcn/ui untuk komponen UI).
- **Database:** MySQL 8.x.
- **ORM/migration:** Prisma.
- **Validasi:** Zod, dipakai di server dan dapat digunakan bersama React Hook Form di client.
- **Autentikasi admin:** session-based auth / solusi auth yang kompatibel dengan Next.js; hash password Argon2id.
- **Deployment:** lingkungan Node.js yang mendukung koneksi MySQL dan migrasi database.
- **Environment:** `DATABASE_URL`, rahasia session/auth, dan konfigurasi dasar lainnya disimpan di `.env` (tidak dikomit).

## 11. Keamanan dan Privasi

Karena NIK termasuk data pribadi sensitif secara operasional, terapkan perlindungan sejak MVP:

- HTTPS di production.
- Validasi dan sanitasi input server-side; gunakan ORM/parameterized query.
- Dashboard serta seluruh endpoint baca data dilindungi autentikasi dan otorisasi admin.
- Password admin di-hash; login memiliki rate limit dasar.
- Terapkan rate limit submit publik dan pencegahan spam sederhana.
- NIK disamarkan di daftar admin, contoh `3576********6002`; tampilkan nilai penuh hanya dalam detail yang membutuhkan otorisasi.
- Hindari memasukkan NIK lengkap dalam URL, analytics, client logs, atau server logs.
- Sertakan teks pemberitahuan tujuan pengumpulan data dan checkbox persetujuan/pemahaman privasi sebelum submit. Tentukan kontak pengelola dan kebijakan retensi data sebelum go-live.
- Backup database berkala dan batasi akses ke database production.

## 12. Acceptance Criteria / Kriteria Selesai

| ID | Skenario | Hasil yang diharapkan |
|---|---|---|
| AC-01 | Peserta membuka form melalui ponsel | Form tampil responsif dan bisa digunakan |
| AC-02 | Peserta mengirim semua field wajib yang valid | Satu record tersimpan di MySQL dan pesan sukses muncul |
| AC-03 | Peserta melewatkan field wajib | Submit ditolak dengan error pada field terkait |
| AC-04 | NIK kurang/lebih dari 16 digit atau mengandung karakter lain | Ditolak, tidak disimpan |
| AC-05 | NIK yang sama dikirim ulang | Ditolak dengan pesan NIK sudah terdaftar; total record tidak bertambah |
| AC-06 | Dua request bersamaan dengan NIK sama | Tepat satu yang tersimpan (UNIQUE constraint bekerja) |
| AC-07 | Input NIK diawali `'` | Tanda petik dibuang; validasi dan cek duplikat berlaku pada NIK bersih |
| AC-08 | Nomor WA diawali `0` | Nilai tersimpan tanpa kehilangan nol di depan |
| AC-09 | Pengguna belum login mengakses dashboard/API admin | Akses ditolak/diarahkan ke login |
| AC-10 | Admin login dengan kredensial valid | Dapat membuka dashboard dan detail |
| AC-11 | Admin mencari dan memfilter peserta | Hasil tabel sesuai query serta filter, dengan pagination |
| AC-12 | Tidak ada data yang cocok | Muncul empty state dan opsi reset filter |
| AC-13 | Admin membuka halaman detail | Seluruh data peserta ditampilkan dengan benar |

## 13. Urutan Implementasi yang Disarankan

1. Inisialisasi Next.js + Tailwind + koneksi MySQL/Prisma.
2. Buat migration tabel `participants` dan `admins`, termasuk UNIQUE pada NIK.
3. Bangun form peserta, validasi, dan endpoint submit.
4. Bangun login admin dan proteksi route/API.
5. Bangun dashboard monitoring, search, filter, pagination, serta detail peserta.
6. Terapkan styling Islami, placeholder logo, pengamanan dasar, dan pengujian acceptance criteria.

## 14. Di Luar Scope Tahap 1

Cetak/generate KTA, kartu digital, upload foto/dokumen, pembayaran, QR code, status persetujuan/verifikasi, edit/hapus peserta, impor/ekspor data, pengelolaan pelatihan, manajemen wilayah terstruktur, multi-role admin, notifikasi email/WhatsApp, dan integrasi eksternal.

---

**Definisi selesai MVP:** Peserta bisa mengisi data satu kali per NIK, data tersimpan aman di MySQL, dan admin bisa login serta memonitor data melalui pencarian, filter, ringkasan, tabel, dan detail peserta.
