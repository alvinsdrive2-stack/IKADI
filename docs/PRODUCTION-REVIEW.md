# Production readiness review

Tanggal: 23 November 2026. Cakupan: seluruh repo (aplikasi Next.js, OCR service, skrip, deploy).
Audit dilakukan dengan membaca kode, memeriksa server produksi, dan menjalankan tes. Bukan
hasil tebakan.

Urutan dari yang paling berdampak. Tiap temuan menyebut lokasi dan perbaikan minimalnya.

---

## Tinggi

### 1. Rate limit login bisa dilewati dengan memalsukan header

`lib/http.ts:7` mengambil IP dari `X-Forwarded-For[0]`. Nginx
(`/etc/nginx/sites-enabled/ikadi.web.id`) memakai `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for`,
yang **menambahkan** `$remote_addr` ke nilai kiriman klien, bukan menggantinya. Artinya klien
bisa mengirim `X-Forwarded-For: 1.2.3.4` sendiri dan nginx meneruskannya di posisi pertama.

Dampak: batas 5 percobaan/10 menit pada login anggota dan admin bisa diakali dengan mengganti
header tiap request. Brute force sandi menjadi praktis. Karena semua peserta sempat diset ke
sandi sementara yang seragam, ini bukan risiko teoretis.

Perbaikan minimal, dua bagian:
- nginx: `proxy_set_header X-Forwarded-For $remote_addr;` (buang nilai kiriman klien), atau di
  app pakai elemen **terakhir** rantai XFF yang ditambahkan proxy tepercaya.
- `lib/http.ts`: ambil dari header yang di-set nginx sendiri (`X-Real-IP`) dan anggap XFF hanya
  sebagai cadangan.

### 2. Rate limit disimpan di memori proses

`lib/rate-limit.ts:1-9` sudah menyebutnya sendiri. Berlaku selama satu proses Node. PM2 saat ini
satu instance, jadi belum bocor; begitu `pm2 scale` atau restart, hitungan hilang.

Perbaikan: pindahkan ke Redis kalau instance ditambah. Untuk sekarang cukup dicatat, bukan
mendesak.

### 3. Sandi sementara seragam masih ada di kode

`lib/munas-password.ts` menyimpan `TEMP_PASSWORD = "IcardIkadi"`. Semua peserta pernah direset
ke nilai itu dan ditandai `must_change_password`. Gerbangnya sudah ada dan diuji, tapi:

- Siapa pun yang bisa membaca repo tahu sandi awal semua akun yang belum pernah ganti.
- 4930 akun ditandai wajib ganti; setiap akun yang belum login sejak reset masih memakai sandi itu.

Perbaikan: pindahkan ke environment variable, dan sediakan query untuk memantau berapa akun yang
masih `must_change_password = true`. Kalau angkanya tidak turun, sosialisasi login belum jalan.

---

## Sedang

### 4. `git pull` di server bisa gagal total karena file root-owned

`ocr-service/` beserta `ocr-service/tests/` milik root. Satu file root-owned
(`ocr-service/tests/test_parser.py`) membuat **seluruh** `git pull`, `git reset --hard`, dan
`git checkout` gagal dengan `unable to unlink ... Permission denied`. Deploy aplikasi jadi harus
lewat salin file manual, yang tidak tercatat di git history server.

Perbaikan permanen butuh sudo sekali:
```
sudo chown -R $USER:$USER /var/www/html/kta-ikadi/ocr-service
```

### 5. Build sebagai root meninggalkan `.next` root-owned, dan folder lama menumpuk

PM2 jalan sebagai root, jadi `.next` hasil build selalu root-owned. Deploy berikutnya tidak bisa
`rm -rf .next`, hanya bisa `mv`, dan tiap deploy meninggalkan ~120 MB. Per 23 November 2026 ada
9 folder `.next.rootold.*` (~900 MB) dan disk 72% terpakai.

Perbaikan: `sudo rm -rf /var/www/html/kta-ikadi/.next.rootold.*`, lalu jalankan PM2 sebagai user
non-root supaya masalahnya tidak berulang.

### 6. Data contoh berisi KTP asli sudah dihapus, tapi riwayat git masih menyimpannya

Fixture `ocr-service/tests/test_parser.py` sebelumnya memuat NIK, nama, tanggal lahir, dan alamat
orang nyata. Sudah diganti data sintetis (commit `bdec275`), tetapi commit lama masih ada di
history repo publik. Kalau repo ini publik, data itu masih bisa diambil.

Perbaikan: putuskan apakah perlu rewrite history (filter-repo). Kalau NIK itu memang milik pemilik
repo dan sudah tidak dipakai, mencatat keputusannya saja sudah cukup — tapi keputusan itu harus
diambil sadar, bukan dibiarkan.

### 7. Identitas commit memakai email pribadi

Semua commit memakai `alvins.drive2@gmail.com` pada repo yang publik. Bukan bug, tapi permanen.

Perbaikan: set `user.email` ke alamat noreply GitHub untuk repo ini.

### 8. `kta_prints` tanpa foreign key

Sudah ditangani di `lib/participant-delete.ts` (dihapus eksplisit dalam transaksi), tapi kolomnya
tetap bisa menyimpan `participant_id` yang tidak ada kalau ada jalur lain yang menulis. Bukan
bug hari ini; catat sebagai batasan yang disengaja.

---

## Rendah

### 9. Error yang ditelan tanpa catatan

`app/api/anggota/foto/route.ts:67,74` — kegagalan menghapus berkas lama diabaikan total. Wajar
(hasil utama sudah tersimpan), tapi tidak ada jejak sama sekali; berkas yatim menumpuk tanpa
ketahuan. Tambahkan `logRouteError`.

### 10. Rate limit tidak membedakan akun

Kunci rate limit hanya IP. Satu IP kantor/warnet dengan beberapa peserta bisa saling mengunci,
sementara penyerang dengan banyak IP tidak terpengaruh. Kombinasi IP + identitas lebih tepat.

### 11. Tidak ada pemantauan error runtime

`logRouteError` menulis ke stdout PM2. Tidak ada agregasi, tidak ada alert. Kalau ada 500 di
produksi, tidak ada yang tahu sampai ada yang melapor. Minimal: pasang agregator log, atau
periksa `pm2 logs` berkala.

---

## Yang sudah baik (dicek, tidak perlu diubah)

- Semua route yang menyentuh data peserta mengambil id dari sesi, bukan dari body
  (`app/api/anggota/profil/data`, `app/api/anggota/sandi`, `app/api/admin/sandi`).
- Upload memeriksa magic bytes dan ukuran; foto KTP disimpan di luar `public/` dan disajikan lewat
  route yang butuh sesi (`app/api/admin/participants/[id]/ktp`).
- Query mentah hanya ada di skrip impor, dan nilainya (`POSITION_FILTER`) konstanta kode, bukan
  input pengguna.
- Timeout keluar sudah dipasang pada panggilan OCR dan pengambilan foto eksternal.
- Semua migrasi yang ada bersifat menambah kolom/tabel; tidak ada yang menulis ulang data.
- Validasi isian memakai satu skema yang sama untuk admin dan anggota, jadi aturannya tidak
  bercabang.
