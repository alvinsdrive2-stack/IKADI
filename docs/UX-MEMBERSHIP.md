# UX-MEMBERSHIP.md — Riset UX Alur Keanggotaan IKADI

Dokumen riset, bukan spesifikasi final. Frontend-dev dan backend-dev pakai ini sebagai landasan keputusan UI. Target WCAG 2.2 AA. Bahasa UI: Indonesia santai-formal, tanpa istilah teknis.

---

## 1. Audit form pendaftaran yang ada

### Struktur sekarang

`components/ParticipantForm.tsx:157-176` mendefinisikan 4 langkah:

| # | Judul | Field inti | Baris |
|---|---|---|---|
| 1 | Dokumen & kontak | Foto KTP, alamat KTP, alamat tinggal, provinsi, kab/kota, WA | 739-808 |
| 2 | Identitas | Asal PW/PD, nama PW/PD, nama lengkap, NIK, gender, status nikah, goldar, tempat lahir, tgl lahir, pas foto | 810-932 |
| 3 | Latar belakang | Pekerjaan, pendidikan, bidang studi, keahlian, pengalaman khutbah, organisasi, kemampuan baca Quran | 934-1030 |
| 4 | Motivasi & persetujuan | Alasan ikut, harapan, consent | 1032-1069 |

Tidak ada field password di mana pun. `lib/schema.ts` belum punya kolom password.

### Kekuatan

- OCR KTP + layar review (baris 613 ke bawah) memangkas pengetikan di ponsel.
- Progress bar + aria-live (baris 724-737) — pengguna selalu tahu di langkah mana.
- Draf localStorage tanpa gambar (baris 71-72, 397-411) — data teks selamat dari refresh.
- ErrorSummary dengan anchor ke field (baris 700-722) — pola 2.4.3/3.3.1 sudah benar.

### Friksi terbesar di ponsel + koneksi lambat

1. **Langkah 1 = upload foto KTP sebelum ada bukti nilai.** Pengguna koneksi 3G menunggu base64 (bisa lebih dari 2 MB) naik ke OCR service sebelum merasakan progres apa pun. Kalau OCR timeout (baris 629 menampilkan ocrError), pengguna sudah bayar data + waktu tapi belum punya apa-apa. Mitigasi: tampilkan indikator progres upload (bukan cuma "Sedang membaca KTP..." di baris 624), dan biarkan jalur manual tetap bisa lanjut walau OCR gagal total — sekarang tombol "Ketik manual" sudah ada di layar review, pastikan tetap tampil saat ocrError.
2. **Foto KTP bisa hilang saat refresh.** DRAFT_FIELDS (baris 109-111) sengaja menyaring ktp dan photo dari draf. Setelah OCR sukses tapi pengguna menutup browser sebelum submit, foto KTP (yang paling susah diambil ulang karena butuh pencahayaan) hilang. Mitigasi: setelah OCR sukses, simpan blob foto di IndexedDB (bukan localStorage) dan restore saat kembali.
3. **Provinsi/Kabupaten di langkah 1 masih input teks bebas** (baris 779-795), padahal lib/wilayah.ts sudah punya 34 provinsi + 514 kab/kota. Ketik "Sumut" vs "Sumatera Utara" bikin data kotor dan admin mesti rapihkan manual sebelum bisa cetak KTA. Ini friksi tersembunyi yang baru terasa di langkah admin, bukan di langkah pengguna. Wajib: ganti ke Select berantai memakai /api/wilayah/provinsi + /api/wilayah/provinsi/:code/kabupaten sebelum fitur keanggotaan rilis — API-CONTRACT.md baris 70 sudah janjikan endpoint-nya.

### Di mana password paling tepat

Bukan langkah 4. Dua alasan:

1. Langkah 4 adalah motivasi + consent — momen reflektif, bukan momen kredensial. Menempelkan password di situ bikin pengguna menganggap password itu formalitas consent, bukan kunci akun permanen. Hasilnya sandi lemah ("12345678" karena cuma mau selesai).
2. Kalau diletakkan setelah "Kirim Data" (di halaman sukses), pengguna mental-model-nya sudah selesai — tambahan langkah setelah sukses = friksi paling mahal secara psikologis, banyak yang tutup browser di halaman sukses.

**Rekomendasi: akhir langkah 2 (Identitas), setelah NIK terisi.** Alasan:

- NIK adalah login id (kontrak API POST /api/anggota/login menerima nik + password). Menaruh password di langkah yang sama dengan NIK membangun asosiasi kredensial: "NIK saya + sandi saya = akun saya".
- Pengguna di titik ini sudah berinvestasi 2 langkah — cukup untuk menerima satu langkah kredensial, belum cukup lelah untuk mengisi asal-asalan.
- Kalau OCR sudah mengisi NIK + nama, field password muncul bersama data yang sudah milik pengguna — terasa seperti mengunci data sendiri, bukan mendaftar layanan asing.

Implementasi UI: satu blok fieldset dengan legend "Buat sandi" berisi:

- Input password min 8 karakter, autocomplete="new-password", hint "Minimal 8 karakter. Gabungkan huruf dan angka."
- Input konfirmasi sandi, autocomplete="new-password".
- Tanpa meter kekuatan sandi (di luar MVP; jangan tambah dependensi).

Simpan ke kolom passwordHash via endpoint register baru (lihat Rekomendasi PM poin 1).

---

## 2. Perbandingan pola registrasi + login

Tiga pola nyata di konteks Indonesia:

| Pola | Contoh nyata | Cocok untuk IKADI? |
|---|---|---|
| A. OTP SMS/WhatsApp dulu, lalu profil | Gojek, Grab, DANA, PeduliLindungi | Tidak. Butuh SMS gateway berbayar; target IKADI adalah ustaz mubaligh di seluruh Indonesia, banyak yang nomor WA-nya bukan nomor utama SMS. Biaya per-SMS tidak masuk akal untuk organisasi nirlaba. |
| B. NIK-first + OCR + sandi di akhir identitas | Aplikasi BPJS Mobile, DJP Online (mendaftar pakai NIK + NPWP), e-KTP di beberapa pemda | Ya. IKADI sudah punya OCR KTP (ParticipantForm.tsx baris 114-127). NIK jadi login id alami karena sudah unik dan permanen. Tidak butuh dependensi eksternal. |
| C. Email + sandi dulu, lalu profil | LinkedIn, situs organisasi global | Tidak. Banyak ustaz senior tidak punya email aktif; menambah field wajib di depan = friksi tambahan. |

**Rekomendasi: pola B.** NIK adalah login id, sandi dibuat di akhir langkah 2.

Sumber riset:

- [PeduliLindungi — NIK-first flow](https://www.pedulilindungi.id/) — pola NIK + OTP untuk layanan publik.
- [DJP Online — registrasi pakai NIK/NPWP](https://www.djp-online.kemenkeu.go.id/) — NIK sebagai kunci identitas di layanan pemerintah.

Batas: riset di atas dari pencarian web umum, bukan audit UI langsung. Angka konversi spesifik tidak tersedia untuk konteks organisasi keagamaan — belum ada data untuk IKADI sendiri.

---

## 3. Alur login anggota

### Halaman /anggota/login

Dua field:

- **NIK** — 16 digit. inputMode="numeric", pattern="[0-9]*", autocomplete="off" (jangan "username" — password manager akan menawarkan NIK sebagai username, itu bagus, tapi autocomplete="username" di input numeric memicu autofill format aneh di beberapa browser Android).
- **Sandi** — type="password", autocomplete="current-password".

Tombol: **Masuk** (primary, full-width, min-h-11).

Di bawah tombol: link sekunder **Lupa sandi?**.

### Pesan error

Ikuti pola ParticipantForm.tsx baris 700-722:

- **Error per field** — NIK kosong: "NIK wajib diisi." NIK bukan 16 digit: "NIK harus 16 digit angka." Sandi kosong: "Sandi wajib diisi."
- **Error login gagal** — dari kontrak API 401 UNAUTHORIZED pesan selalu "NIK atau sandi salah." (tidak membedakan NIK tidak terdaftar vs sandi salah — keputusan keamanan yang benar, pertahankan). Tampilkan sebagai ErrorSummary di atas form + role="alert" + fokus pindah ke summary.
- **Rate limit** — 429 RATE_LIMIT pesan dari API: "Terlalu banyak percobaan. Coba lagi dalam beberapa menit." Tampilkan apa adanya.
- **Koneksi gagal** — sama dengan NETWORK di ParticipantForm.tsx baris 68-69: "Koneksi bermasalah. Coba lagi."

### NIK 16 digit: masalah nyata di input numeric

1. **Paste dari WhatsApp/notes** sering menyertakan spasi, tanda hubung, atau baris baru. Wajib: sanitasi di onChange — value.replace non-digit lalu slice(0, 16). Tampilkan hint counter X/16 digit.
2. **Autofill password manager** kadang mengisi NIK di field sandi karena autocomplete salah. Pastikan field sandi autocomplete="current-password", bukan "off".
3. **Keyboard numeric Android** punya tombol spasi + emoji; pengguna tak sadar sudah memasukkan spasi. Solusi: sanitasi otomatis (poin 1) + counter X/16 digit berwarna text-primary saat 16, text-ink-muted saat kurang.
4. **iOS Safari zoom** — input kurang dari 16px memicu zoom. Semua input harus text-base (DESIGN.md 1.2). Jangan turunkan.

### Lupa sandi (di luar scope MVP)

Jangan buat halaman reset via email — tidak ada infra email di MVP. Cukup:

- Link **Lupa sandi?** mengarah ke halaman statis /anggota/lupa-sandi.
- Isi halaman:

  > Hubungi admin IKADI di wilayah Anda melalui WhatsApp. Sebutkan NIK dan nama lengkap Anda. Admin akan membantu mengatur ulang sandi Anda.

- Tombol sekunder "Kembali ke Masuk".

Ini mencegah pengguna buntu: mereka tahu langkah konkret. Admin punya PATCH membership dengan newPassword (kontrak API baris 109) — alur konsisten dengan kapabilitas admin yang sudah dirancang.

---

## 4. Alur "Kartu Saya" untuk anggota

Halaman /anggota/kartu — hanya bisa diakses setelah login.

### State A — nomor belum terbit (memberNumber null)

Layout:

```
Kartu Tanda Anggota IKADI   (H1)

[ Ilustrasi kartu kosong — abu-abu, tanpa QR ]

Nomor anggota Anda belum terbit.

Setiap nomor anggota diterbitkan saat kartu KTA
dicetak oleh admin IKADI. Proses ini memastikan
setiap nomor unik dan resmi.

Nomor akan muncul di halaman ini otomatis setelah
admin mencetak kartu Anda.

[Kembali ke Beranda]  [Hubungi Admin via WhatsApp]
```

Copy ini sengaja:

- Tidak menyalahkan pengguna ("Anda belum terverifikasi", "Menunggu persetujuan" — dua-duanya mengisyaratkan penolakan).
- Menjelaskan mengapa menunggu: nomor terbit saat admin cetak, bukan saat daftar. Ini fakta teknis dari kontrak API POST /kta yang menerbitkan nomor plus memakai kuota.
- Menyediakan CTA kedua ke WhatsApp (nomor dari SiteFooter) untuk kasus menunggu terlalu lama.

### State B — nomor sudah terbit

Tampilkan kartu digital mirip KtaCard.tsx versi anggota:

- Nama lengkap, nomor anggota (font mono besar, bisa disalin), level, asal PW/PD, provinsi, kab/kota, tanggal terbit, status keanggotaan (badge AKTIF/NONAKTIF/PURNABAKTI).
- QR verifikasi (dari AnggotaProfile.kta.qrPng).
- Link publik "Lihat halaman verifikasi" ke /verifikasi/:nomor.
- **Tidak ada tombol "Cetak sendiri" di MVP.**

### Bisa cetak sendiri?

Tidak di MVP. Konsekuensi kuota 10:

- Kuota cetak 10 adalah batas trial untuk menguji alur cetak. Kalau anggota bisa cetak sendiri, satu anggota = satu cetak = kuota habis dalam 10 anggota pertama. Kuota jadi tidak berarti.
- POST /kta hanya bisa dipanggil sesi admin (kontrak API baris 120). Keputusan desain yang benar — pertahankan.
- Solusi anggota yang butuh kartu fisik: hubungi admin via WhatsApp. Admin yang memutuskan kapan mencetak.

Batas desain: kalau kelak kuota dinaikkan atau dihapus, tambahkan tombol "Unduh PDF kartu saya" di sini. Ponytail, jangan dibangun sekarang.

---

## 5. Blok keanggotaan di halaman admin

### Masalah halaman detail sekarang

ParticipantDetail.tsx menampilkan semua field datar dalam dl dua kolom. Data keanggotaan baru (nomor anggota, level, wilayah, status, hasPassword, eligible) kalau ditambahkan apa adanya akan jadi 40+ baris datar — admin kehilangan hierarki.

### Hierarki yang diusulkan

Susun menjadi 4 blok, urutan = frekuensi akses admin:

1. **Status keanggotaan** — paling sering dicek.
   - Badge status: AKTIF / NONAKTIF / PURNA BAKTI.
   - Nomor anggota (mono besar) + tanggal terbit, atau tombol **Cetak KTA** kalau belum terbit dan eligible=true.
   - Banner NOT_ELIGIBLE kalau eligible=false — tampilkan ineligibleReason apa adanya.
   - Sisa kuota cetak dari /api/admin/stats kta.remaining.

2. **Level & wilayah** — sering diubah sebelum cetak.
   - Level (1-7), provinsi, kab/kota. Edit via inline Select.
   - Kalau memberNumber tidak null: tampil mode baca + ikon kunci (lihat bawah).

3. **Kredensial login** — jarang, tapi penting saat ada keluhan.
   - hasPassword true: "Sandi sudah diatur" + tombol sekunder "Atur ulang sandi".
   - hasPassword false: "Belum ada sandi — anggota belum bisa login" + tombol primary "Buat sandi awal".

4. **Data pendaftaran** — data lama yang sudah ada di ParticipantDetail.tsx.

Blok 1-3 di atas blok 4. Admin melihat status keanggotaan dalam 2 detik tanpa scroll.

### Interaksi "nomor sudah terbit = level/wilayah terkunci"

Kontrak API baris 115 mengembalikan 409 FORBIDDEN dengan pesan "Nomor anggota sudah terbit. Level dan wilayah tidak bisa diubah." Kalau frontend cuma mengandalkan error ini, admin akan mencoba edit, submit, baru ditolak — friksi tidak perlu.

Lakukan di frontend:

- GET /membership mengembalikan memberNumber. Kalau tidak null:
  - Ganti Select level/provinsi/kab dengan teks statis + ikon gembok SVG (aria-hidden) + teks kecil di bawahnya:

    > Nomor anggota sudah terbit. Level dan wilayah tidak bisa diubah karena nomor memuat kode level + wilayah + tahun. Kalau ada kesalahan data, hubungi Ketua Divisi IT.

  - Ikon kunci bukan satu-satunya penanda — teks menjelaskan mengapa terkunci. Memenuhi WCAG 1.4.1 (Use of Color) dan 3.3.2 (Labels or Instructions).
  - **Jangan** pakai disabled pada elemen form — screen reader skip elemen disabled. Pakai teks statis + aria-describedby yang menjelaskan.
- membershipStatus dan newPassword tetap bisa diedit walau nomor terbit (kontrak API baris 117). Pastikan UI tidak mengunci itu juga.

### Reset sandi — konfirmasi

Reset sandi mengubah akses orang lain. Konfirmasi dua langkah:

1. Klik "Atur ulang sandi" maka dialog inline (bukan window.confirm) muncul di tempat tombol:

   > **Atur ulang sandi anggota ini?**
   >
   > Sandi lama tidak akan berfungsi lagi. Berikan sandi baru kepada anggota melalui WhatsApp.
   >
   > [Input sandi baru — min 8 karakter]
   >
   > [Batal] [Simpan sandi baru]

2. Setelah sukses: role="status" alert hijau "Sandi baru tersimpan." di atas blok kredensial. Tampilkan sandi baru satu kali dalam teks mono + tombol Salin (pola CopyButton di ParticipantDetail.tsx baris 308-332) supaya admin bisa langsung kirim via WA.

Jangan pakai window.confirm — tidak bisa diakses keyboard dengan baik di beberapa browser, tidak bisa di-styling, dan tidak bisa menampung input sandi baru.

---

## 6. Halaman verifikasi QR (publik)

Route: /verifikasi/:nomor (server component, baca DB, tanpa sesi). Kontrak API baris 160-169.

### Wajib tampil

- Logo IKADI + nama organisasi di header.
- Nama lengkap anggota.
- Nomor anggota (font mono).
- Level (Anggota / Wilayah / dst).
- Asal PW/PD + nama.
- Provinsi, kab/kota.
- Tanggal terbit nomor.
- Status keanggotaan — badge berwarna + teks (bukan warna saja).
- Nama Ketua Umum dan Sekjen (dari getPejabat() di lib/kta.ts baris 12).

### Wajib TIDAK tampil

Kontrak API baris 166-167 sudah mengikat. Larangan:

- NIK — meski ter-masked, jangan tampilkan sama sekali.
- Alamat (KTP maupun tinggal).
- Nomor WhatsApp.
- Path file KTP / foto KTP.
- passwordHash.
- ID internal (participantId, id dari DB).

Pemindai QR harus percaya halaman ini karena datanya spesifik — kalau ada NIK, halaman jadi target doxxing. Tampilkan cukup data untuk membedakan satu anggota dari anggota lain, tanpa membuka data pribadi.

### Meyakinkan dalam kurang dari 3 detik

Orang yang scan QR di kartu fisik butuh jawaban instan: ini kartu asli atau palsu. Tiga elemen yang harus terlihat dalam satu layar ponsel tanpa scroll:

1. **Banner atas hijau penuh** — pakai --color-primary, teks putih, ikon centang: "Kartu Tanda Anggota IKADI — TERVERIFIKASI". Kalau nomor tidak ditemukan atau format salah, banner berubah merah --color-danger: "Kartu Tidak Dikenali" (status HTTP tetap 404 sesuai kontrak API baris 169).
2. **Foto pas anggota** — kalau photoPath tidak null, tampilkan. Wajah adalah verifikator paling cepat: pemindai membandingkan wajah di kartu fisik dengan foto di halaman. Ini bukan data pribadi sensitif — foto ini memang dipakai di kartu fisik.
3. **Nama + nomor dalam font besar** — text-2xl font-bold untuk nama, font-mono text-lg untuk nomor. Dua data ini yang dicocokkan pemindai dengan kartu fisik.

Sisanya (level, asal, tanggal, status, pejabat) di bawah lipatan pertama — penting untuk audit manual, tidak untuk keputusan 3 detik.

### Copy konkret (Bahasa Indonesia)

**State valid:**

```
[Hijau banner + ikon centang]
Kartu Tanda Anggota IKADI — TERVERIFIKASI

[Foto pas — bulat, 96px]

Ust. Ahmad Fauzi, S.Pd.I.

Nomor Anggota:  6.16.01.26.0001

Level      : PW
Asal       : PW IKADI DIY
Provinsi   : Daerah Istimewa Yogyakarta
Kab/Kota   : Kab. Sleman
Terbit     : 6 November 2026
Status     : AKTIF

Kartu ini diterbitkan atas nama Ikatan Dai Indonesia (IKADI).

Ketua Umum: [nama]
Sekretaris Jenderal: [nama]

Halaman ini dihasilkan otomatis oleh sistem keanggotaan IKADI.
```

**State nomor tidak ditemukan:**

```
[Merah banner + ikon silang]
Kartu Tidak Dikenali

Nomor X.XX.XX.XX.XXXX tidak terdaftar dalam sistem keanggotaan IKADI.

Kemungkinan penyebab:
- Nomor salah ketik — periksa kembali angka di kartu.
- Kartu palsu atau dipalsukan.
- Kartu sudah dicabut oleh IKADI.

Jika Anda yakin nomor ini valid, laporkan ke admin IKADI
melalui WhatsApp resmi IKADI.

[Nomor WhatsApp resmi — dari SiteFooter]
```

Jangan sebut "kartu palsu" sebagai satu-satunya kemungkinan — bisa jadi salah ketik. Tapi jangan juga menghapus kemungkinan itu — pemindai perlu tahu bahwa sistem ini bisa mendeteksi pemalsuan.

---

## 7. Checklist aksesibilitas WCAG 2.2 AA

Khusus layar-layar baru (login, kartu, verifikasi, blok keanggotaan di admin).

### Kontras (1.4.3, 1.4.11)

- [ ] Semua teks di atas --color-surface pakai --color-ink atau --color-ink-muted (8.6:1 di putih, aman).
- [ ] Teks di atas --color-primary (#166534) selalu putih — kontras sekitar 8:1. Jangan pakai --color-accent (#D4AF37) di atas hijau (gagal 1.4.3).
- [ ] Teks di atas --color-primary-soft pakai --color-primary-ink (8.8:1) — untuk badge AKTIF.
- [ ] Border input selalu --color-control-border (4.6:1, WCAG 1.4.11), bukan --color-border (1.5:1 — hanya dekoratif). Token di globals.css baris 17-22.
- [ ] Banner verifikasi hijau: teks putih di atas #166534, bukan emas.
- [ ] Banner verifikasi merah: teks putih di atas #B91C1C, kontras sekitar 7:1.

### Target sentuh (2.5.8)

- [ ] Semua tombol dan link interaktif min-h-11 (44px) — di ponsel. Sudah jadi standar di ParticipantForm.tsx. Terapkan di login, kartu, admin blok keanggotaan.
- [ ] Tombol Salin nomor anggota min-h-11 di mobile, boleh md:h-9 di desktop (pola CopyButton baris 324).
- [ ] Link anchor di ErrorSummary punya padding cukup — jangan cuma teks underline tipis.

### Label dan nama aksesibel (1.1.1, 3.3.2, 4.1.2)

- [ ] Setiap input punya label dengan for. Bungkus dengan Field (DESIGN.md bagian 8 item 3) — jangan raw input.
- [ ] Ikon kunci di field level/wilayah admin: aria-hidden="true", makna disampaikan teks di bawahnya.
- [ ] Foto pas di halaman verifikasi: alt="[Nama lengkap]" — bukan alt="foto".
- [ ] Logo IKADI: role="img" aria-label="Logo IKADI" — sudah di Logo.tsx, pertahankan.
- [ ] QR di kartu anggota: alt="Kode QR verifikasi keanggotaan".

### Fokus (2.4.7, 2.4.11, 2.4.13)

- [ ] :focus-visible global di globals.css baris 54-58 sudah benar (outline biru 2px offset 2px) — jangan timpa.
- [ ] Di atas banner hijau/merah: focus-visible:outline-white focus-visible:outline-offset-2 (sudah diatur di mockup admin-detail.html baris 25).
- [ ] Tidak ada outline: none atau focus:outline-none di mana pun.
- [ ] Urutan DOM = urutan visual di semua halaman baru (2.4.3).
- [ ] Setelah login gagal, fokus pindah ke ErrorSummary (pola focusOnMount di ParticipantForm.tsx baris 702).
- [ ] Setelah simpan sandi baru di admin, fokus pindah ke alert sukses.
- [ ] Tidak ada focus trap — semua dialog inline (bukan modal), Tab bebas keluar.

### Error dan status announcement (3.3.1, 3.3.3, 4.1.3)

- [ ] Error per field: aria-invalid="true" + aria-describedby="[id]-error".
- [ ] ErrorSummary: role="alert", tabIndex=-1, fokus dipindah ke sini saat submit gagal.
- [ ] Status sukses (sandi tersimpan, kartu tercetak): role="status" (aria-live polite).
- [ ] Pesan error menyebut format yang diharapkan: "NIK harus 16 digit angka", bukan "NIK tidak valid".
- [ ] Banner verifikasi hijau/merah: role="status" untuk valid, role="alert" untuk tidak dikenali.

### Tanpa warna (1.4.1)

- [ ] Badge status keanggotaan selalu bertuliskan (AKTIF, bukan cuma bulatan hijau).
- [ ] Ikon centang/silang di banner verifikasi + teks TERVERIFIKASI / TIDAK DIKENALI.
- [ ] Field terkunci: ikon gembok + teks penjelasan, bukan cuma abu-abu.
- [ ] Sisa kuota cetak: angka + teks "Sisa X dari 10", bukan cuma progress bar.

### Navigasi dan struktur (1.3.1, 2.1.1, 2.4.1)

- [ ] Satu h1 per halaman.
- [ ] Blok status keanggotaan, level/wilayah, kredensial di admin: section aria-labelledby.
- [ ] Halaman verifikasi publik: skip link "Lompat ke konten utama" (pola mockup admin-detail.html baris 75).
- [ ] Halaman login: skip link juga, karena halaman publik.

### Form khusus

- [ ] NIK login: inputMode="numeric", sanitasi non-digit di onChange, hint counter X/16 digit.
- [ ] Password login: autocomplete="current-password". Password baru: autocomplete="new-password".
- [ ] Tidak ada validasi saat mengetik (mode onSubmit di RHF, reValidateMode onChange — sudah di ParticipantForm.tsx baris 211-212). Pertahankan di login dan reset sandi.
- [ ] Filter admin tidak auto-submit (3.2.2) — sudah diatur di AdminParticipants.tsx pola lama.

---

## 8. Rekomendasi ke PM

### 1. Tambah field password + endpoint register anggota SEBELUM rilis UI login

**Apa:** Backend mesti menambah kolom passwordHash di tabel Participant, endpoint POST /api/anggota/register (menerima NIK + password, hanya boleh dipanggil sekali per NIK), dan field hasPassword di MembershipAdmin (sudah disebut di kontrak API baris 93 tapi belum ada endpoint untuk mengisinya dari sisi anggota).

**Kenapa:** Tanpa ini, login anggota tidak punya sumber kredensial. PATCH newPassword dari admin hanya bisa mengatur ulang, tidak bisa mendaftarkan sandi pertama.

**Dampak kalau diabaikan:** Fitur login anggota tidak bisa rilis. Atau lebih buruk — frontend memaksa admin mengisi sandi untuk semua anggota satu per satu secara manual, membunuh nilai fitur "anggota bisa register sendiri".

### 2. Ganti input bebas provinsi/kabupaten di langkah 1 dengan dropdown berantai

**Apa:** Gunakan lib/wilayah.ts + endpoint /api/wilayah/provinsi + /kabupaten untuk mengganti input province dan city di ParticipantForm.tsx baris 779-795 menjadi Select berantai.

**Kenapa:** Nomor anggota (L.WW.DD.YY.NNNN) memakai provinceCode + regencyCode dari master wilayah (kontrak API baris 188). Data bebas dari form sekarang tidak bisa dipakai untuk menerbitkan nomor tanpa admin merapikan manual satu per satu.

**Dampak kalau diabaikan:** Admin jadi bottleneck — setiap pendaftar baru mesti dirapikan wilayahnya sebelum bisa dicetak. Pada 100 pendaftar, ini 100 sesi edit manual. Trial kuota 10 masih terlihat aman tapi begitu naik kuota, alur jadi macet.

### 3. Selesaikan halaman verifikasi QR publik sebagai satu unit utuh

**Apa:** Route /verifikasi/:nomor — server component, layout banner + foto + nama + nomor + detail + pejabat, sesuai spesifikasi bagian 6 di atas.

**Kenapa:** QR di KTA fisik menunjuk ke sini. Kartu fisik dicetak tanpa halaman ini berarti QR mati. Anggota pertama yang menerima kartu akan scan QR-nya sendiri dan menemukan 404 — momen kredibilitas hancur di depan pengguna paling termotivasi.

**Dampak kalau diabaikan:** Kartu tercetak (dari 10 kuota trial) tidak bisa diverifikasi publik. Kesannya IKADI menerbitkan kartu tanpa sistem, padahal sistemnya sudah setengah jadi.

### 4. Jangan izinkan anggota cetak sendiri di MVP

**Apa:** Di halaman "Kartu Saya" anggota, tampilkan kartu digital + QR, tanpa tombol "Unduh PDF" atau "Cetak".

**Kenapa:** Kuota cetak 10 adalah batas trial. Setiap cetak memakai kuota. Kalau anggota bisa memicu cetak, kuota habis dalam 10 anggota pertama — tidak terasa seperti trial, jadi kekacauan.

**Dampak kalau diabaikan:** Kuota habis dalam hitungan hari setelah rilis. Admin tidak bisa mencetak kartu untuk anggota prioritas. Trial gagal menunjukkan alur end-to-end.

### 5. Tambahkan provinceCode + regencyCode di response detail admin

**Apa:** GET /api/admin/participants/:id sekarang mengembalikan province dan city sebagai nama string (ParticipantDetail.tsx baris 24-25). Tambahkan provinceCode dan regencyCode di response, atau pastikan endpoint /membership selalu dipanggil paralel di halaman detail admin.

**Kenapa:** Untuk mengedit level/wilayah di blok keanggotaan admin, frontend butuh kode (untuk pre-select Select), bukan nama. Tanpa kode, admin melihat "PW IKADI DIY" tapi dropdown butuh kode 16 untuk memilih provinsi.

**Dampak kalau diabaikan:** Edit level/wilayah di admin tidak bisa di-pre-select. Admin mesti pilih ulang dari nol setiap kali buka halaman — friksi kecil tapi 100 kali sehari.

---

## Catatan riset

Pencarian web dilakukan untuk bagian 2 (pola registrasi) dan bagian 6 (verifikasi publik). Tidak ditemukan studi konversi spesifik untuk konteks organisasi keagamaan Indonesia — belum ada data kuantitatif untuk IKADI sendiri. Rekomendasi didasarkan pada:

- Pola umum aplikasi kependudukan dan keanggotaan Indonesia (PeduliLindungi, BPJS, DJP Online).
- Kontrak API dan kode existing di repo ini.
- WCAG 2.2 AA dan DESIGN.md.

Semua keputusan copy konkret (bagian 3, 4, 6) adalah usulan — perlu review Ketua Divisi IT dan Sekjen sebelum dirilis, terutama pesan "kartu palsu" di halaman verifikasi yang berdampak reputasi.
