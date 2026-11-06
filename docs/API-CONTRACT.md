# Kontrak API — Sistem Keanggotaan IKADI

Dokumen ini **mengikat**. Backend mengimplementasikan persis bentuk di bawah; frontend
memanggil persis bentuk di bawah. Kalau salah satu pihak butuh ubah kontrak, ubah file ini
dulu dan kabari yang lain. Jangan diam-diam beda.

Semua response JSON, `Content-Type: application/json`.

**Bentuk sukses**: `{ ok: true, data: ... }`
**Bentuk gagal**: `{ ok: false, code: "<KODE>", message: "<pesan siap tampil>", errors?: { [field]: string } }`

Kode error yang dipakai: `UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION`, `NIK_DUPLICATE`,
`NOT_FOUND`, `PRINT_LIMIT_REACHED`, `NOT_ELIGIBLE`, `RATE_LIMIT`, `SERVER_ERROR`.

---

## A. Auth anggota

### `POST /api/anggota/login`
Body: `{ "nik": "16 digit", "password": "..." }`

- `200`: `{ ok: true, data: { fullName, memberNumber: string | null, levelCode, originType, originName } }`
  Set cookie sesi `ikadi_anggota` (httpOnly, 30 hari).
- `400 VALIDATION`: NIK bukan 16 digit / password kosong.
- `401 UNAUTHORIZED`: `message: "NIK atau sandi salah."` — **pesan sama** untuk NIK tidak ada
  maupun sandi salah.
- `429 RATE_LIMIT`: 5 percobaan / 10 menit per IP.

### `POST /api/anggota/logout`
- `200`: `{ ok: true, data: null }`, cookie dihapus. Tanpa auth juga 200.

### `GET /api/anggota/me`
Butuh sesi anggota.
- `200`: `{ ok: true, data: AnggotaProfile }`
- `401 UNAUTHORIZED`

```ts
type AnggotaProfile = {
  fullName: string;
  nik: string;                    // hanya untuk anggota yang login
  originType: "PW" | "PD";
  originName: string;
  levelCode: number;              // 1..7
  levelLabel: string;             // "Anggota", "Wilayah", dst
  membershipStatus: "AKTIF" | "NONAKTIF" | "PURNABAKTI";
  province: string | null;        // nama wilayah (hasil join), bukan kode
  city: string | null;            // nama kabupaten/kota
  memberNumber: string | null;    // "6.16.01.26.0001" — null = belum terbit
  memberNumberIssuedAt: string | null; // ISO
  memberSince: string;            // ISO, created_at
  photoPath: string | null;       // path relatif, prepend "/" untuk src
  kta: {                          // null kalau belum punya nomor
    verifyUrl: string;
    qrPng: string;                // data URL PNG, 600px
  } | null;
};
```
Catatan: `AnggotaProfile` **tidak memuat** alamat, nomor WhatsApp, path KTP, atau
`passwordHash`. Jangan tambahkan.

---

## B. Wilayah (dropdown berantai)

### `GET /api/wilayah/provinsi`
Publik, cache-able.
- `200`: `{ ok: true, data: [{ code: "16", name: "Sumatera Selatan" }, ...] }` — 34 item urut kode.

### `GET /api/wilayah/provinsi/:code/kabupaten`
- `200`: `{ ok: true, data: [{ code: "01", name: "Ogan Komering Ulu" }, ...] }` urut `code`.
- `404 NOT_FOUND`: kode provinsi tidak ada.

---

## C. Admin — kelola keanggotaan

Semua butuh sesi admin (`ikadi_admin`). `401 UNAUTHORIZED` kalau tidak.

### `GET /api/admin/participants/:id/membership`
- `200`:
```ts
type MembershipAdmin = {
  participantId: string;
  fullName: string;
  levelCode: number;
  levelLabel: string;
  provinceCode: string | null;
  provinceName: string | null;
  regencyCode: string | null;
  regencyName: string | null;
  memberNumber: string | null;
  memberNumberIssuedAt: string | null;
  membershipStatus: "AKTIF" | "NONAKTIF" | "PURNABAKTI";
  hasPassword: boolean;
  eligible: boolean;               // true = boleh cetak KTA
  ineligibleReason: string | null; // alasan siap tampil kalau eligible=false
};
```
- `404 NOT_FOUND`

### `PATCH /api/admin/participants/:id/membership`
Body (semua opsional, kirim yang berubah saja):
```ts
{
  levelCode?: 1|2|3|4|5|6|7;
  provinceCode?: string | null;   // 2 digit
  regencyCode?: string | null;    // 2 digit
  membershipStatus?: "AKTIF" | "NONAKTIF" | "PURNABAKTI";
  newPassword?: string;           // min 8 karakter — reset sandi anggota
}
```
- `200`: `{ ok: true, data: MembershipAdmin }` (bentuk sama dengan GET)
- `400 VALIDATION`: level di luar 1..7; provinsi tanpa kabupaten atau sebaliknya; kode
  wilayah tidak ada di master; `newPassword` < 8 karakter.
- `409 FORBIDDEN`: `message: "Nomor anggota sudah terbit. Level dan wilayah tidak bisa diubah."`
  → **hanya berlaku untuk `levelCode`/`provinceCode`/`regencyCode`**. `membershipStatus` dan
  `newPassword` tetap boleh diubah walau nomor sudah terbit.

### `POST /api/admin/participants/:id/kta`
**Bukan GET.** Memanggil endpoint ini = mencetak = memakai kuota. Dipanggil sekali saat
tombol "Cetak KTA" ditekan, bukan saat halaman dibuka.

- `200`:
```ts
type KtaPrintResult = {
  memberNumber: string;        // nomor yang tercetak (baru atau lama)
  issued: boolean;             // true kalau nomor baru diterbitkan di panggilan ini
  fullName: string;
  originType: "PW" | "PD";
  originName: string;
  levelLabel: string;
  provinceName: string | null;
  regencyName: string | null;
  photoPath: string | null;
  issuedAt: string;            // ISO, untuk teks "terdaftar sejak"
  verifyUrl: string;
  qrPng: string;               // data URL
  remainingPrints: number;     // sisa kuota setelah panggilan ini
  pejabat: {
    ketuaUmum: { nama: string; jabatan: string };
    sekjen: { nama: string; jabatan: string };
  };
};
```
- `409 PRINT_LIMIT_REACHED`: `message: "Kuota cetak KTA untuk trial sudah habis (10/10)."`
- `409 NOT_ELIGIBLE`: peserta belum punya `provinceCode`/`regencyCode` atau level tidak valid.
  `message` menjelaskan apa yang harus dilengkapi admin dulu.
- `404 NOT_FOUND`: peserta tidak ada.

### `GET /api/admin/stats`
Tambahan pada response yang sudah ada: field `kta`:
```ts
{ kta: { printed: number; limit: number; remaining: number } }
```

---

## D. Verifikasi publik

### `GET /verifikasi/:nomor` (halaman, bukan API)
`nomor` = nomor anggota dengan titik (`6.16.01.26.0001`). Halaman server-side, baca DB.

Yang **boleh** tampil: nama, nomor anggota, level, asal (PW/PD + nama), provinsi, kab/kota,
tanggal terbit, status keanggotaan, nama Ketua Umum & Sekjen.

Yang **dilarang** tampil dalam bentuk apapun: NIK, alamat, nomor WhatsApp, path file KTP,
`passwordHash`, id internal.

Nomor tidak ada / format salah → tampil "Kartu tidak dikenali", **status HTTP 404**.

---

## E. Aturan yang mengikat backend

1. **Nomor permanen.** Terbit sekali, tidak pernah berubah. `PATCH .../membership` menolak
   perubahan level/wilayah setelah nomor terbit.
2. **Terbit atomik.** Pakai `prisma.$transaction` + `upsert` pada `member_number_sequences`
   dengan increment. Dua admin mencetak bersamaan tidak boleh dapat NNNN sama.
3. **Unique index adalah kebenaran akhir.** Pre-check boleh, tapi tangkap pelanggaran unique
   dan ulangi sekali.
4. **Kuota dari DB**, hitung `COUNT(*) FROM kta_prints`, bukan in-memory. Limit dari
   `process.env.KTA_PRINT_LIMIT` default 10.
5. **Sesi terpisah.** Cookie anggota `ikadi_anggota`, admin `ikadi_admin`. Secret sama boleh,
   `adminId`/`participantId` tidak boleh saling pakai. `proxy.ts` memverifikasi keduanya
   secara terpisah.
6. **`provinceCode`/`regencyCode` wajib berpasangan.** Kalau salah satu diisi, yang lain wajib.
7. **Format nomor**: `L.WW.DD.YY.NNNN`, L=level, WW=provinceCode, DD=regencyCode,
   YY=tahun `created_at` mod 100, NNNN=serial 4 digit per (level, provinsi, kab/kota, tahun),
   mulai 0001. Disimpan di kolom `member_number` sebagai string bertitik.

---

## F. Yang sudah tersedia untuk frontend

- `lib/wilayah.ts` — `PROVINCES` (34) + `REGENCIES` (514), tipe `ProvinceRow`/`RegencyRow`.
  Frontend **boleh** impor langsung untuk dropdown, tapi server tetap validasi.
- Pola UI yang ada: `components/AdminNav.tsx` (`SessionExpired`), `components/ui/*`,
  token warna di `app/globals.css` `@theme`. Ikuti, jangan bikin sistem baru.
- `docs/DESIGN.md` — token warna, komponen, target WCAG 2.2 AA.
