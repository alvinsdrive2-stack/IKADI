/**
 * Impor peserta MUNAS IV IKADI dari database `munas_ikadi` ke `ikadi`.
 *
 *   npx tsx scripts/import-munas-participants.ts            # dry-run
 *   npx tsx scripts/import-munas-participants.ts --apply    # benar-benar menulis
 *
 * Aturan (disepakati pemilik proyek):
 * - Hanya NIK 16 digit. NIK lain dilewati.
 * - NIK yang sudah ada di `ikadi.participants` dilewati (tidak ditimpa).
 * - NIK duplikat di sumber dan tanggal NIK mustahil dilewati.
 * - Provinsi harus ada di master `provinces` (alias DIY/Bangka Belitung
 *   disamakan). Provinsi yang tidak ada di master dilewati.
 * - `birth_place` dan `occupation` diisi string kosong, `address` diisi string
 *   kosong (kolom lama yang tidak dipakai form), dan
 *   `needs_profile_completion = true` supaya anggota melengkapi sendiri.
 * - Sandi awal `Munas` + DDMMYY dari NIK; kalau tanggal mustahil dipakai
 *   sandi default. Semua wajib diganti saat melengkapi profil.
 *
 * Skrip idempoten: baris yang sudah masuk (berdasarkan NIK) dilewati, jadi aman
 * dijalankan ulang.
 */
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";
import {
  MUNAS_DEFAULT_PASSWORD,
  birthDateFromNik,
  passwordFromNik,
} from "../lib/munas-password";

const APPLY = process.argv.includes("--apply");
const MUNAS_URL = process.env.MUNAS_DATABASE_URL;

type MunasRow = {
  nik: string;
  full_name: string;
  phone: string | null;
  province: string | null;
  region_name: string | null;
};

/** Provinsi MUNAS yang namanya beda dari master IKADI. */
const PROVINCE_ALIAS: Record<string, string> = {
  "Daerah Istimewa Yogyakarta (DIY)": "DI Yogyakarta",
  "Bangka Belitung": "Kepulauan Bangka Belitung",
};

type SkipReason =
  | "nik_bukan_16_digit"
  | "nik_duplikat_sumber"
  | "nik_sudah_ada"
  | "tanggal_nik_mustahil"
  | "provinsi_tidak_dikenal"
  | "provinsi_kosong";

async function main() {
  if (!MUNAS_URL) {
    throw new Error("MUNAS_DATABASE_URL belum di-set (contoh di .env.local)");
  }

  // Lewat tunnel SSH, server meminta kunci RSA untuk auth; koneksi tanpa TLS
  // gagal dengan ER_CANNOT_RETRIEVE_RSA_KEY. Opsi SSL diteruskan lewat driver.
  const munas = new PrismaClient({
    adapter: new PrismaMariaDb(MUNAS_URL, { ssl: { rejectUnauthorized: false } }),
  });
  const ikadi = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL!) });

  try {
    const rows = await munas.$queryRawUnsafe<MunasRow[]>(
      `SELECT p.nik, p.fullName AS full_name, p.phone, r.province, r.name AS region_name
         FROM participants p
         JOIN regions r ON r.id = p.regionId
        ORDER BY p.id ASC`,
    );

    const provinces = await ikadi.province.findMany({ select: { code: true, name: true } });
    const provinceByCode = new Map(provinces.map((p) => [p.code, p.name]));
    const provinceCodeByName = new Map(provinces.map((p) => [p.name, p.code]));

    const existing = new Set(
      (
        await ikadi.participant.findMany({
          where: { nik: { in: rows.map((r) => r.nik).filter((n) => /^\d{16}$/.test(n)) } },
          select: { nik: true },
        })
      ).map((p) => p.nik),
    );

    const currentYear = new Date().getFullYear();
    const seenNik = new Set<string>();
    const skipped: Record<SkipReason, { name: string; nik: string; extra?: string }[]> = {
      nik_bukan_16_digit: [],
      nik_duplikat_sumber: [],
      nik_sudah_ada: [],
      tanggal_nik_mustahil: [],
      provinsi_tidak_dikenal: [],
      provinsi_kosong: [],
    };

    const toInsert: {
      nik: string;
      fullName: string;
      whatsapp: string;
      birthDate: Date;
      provinceCode: string;
      password: string;
    }[] = [];

    for (const row of rows) {
      const name = row.full_name ?? "(tanpa nama)";
      const nik = (row.nik ?? "").trim();

      if (!/^\d{16}$/.test(nik)) {
        skipped.nik_bukan_16_digit.push({ name, nik });
        continue;
      }
      if (seenNik.has(nik)) {
        skipped.nik_duplikat_sumber.push({ name, nik });
        continue;
      }
      seenNik.add(nik);

      if (existing.has(nik)) {
        skipped.nik_sudah_ada.push({ name, nik });
        continue;
      }

      const birthDate = birthDateFromNik(nik, currentYear);
      if (!birthDate) {
        skipped.tanggal_nik_mustahil.push({ name, nik });
        continue;
      }

      if (!row.province) {
        skipped.provinsi_kosong.push({ name, nik, extra: row.region_name ?? "-" });
        continue;
      }
      const provinceName = PROVINCE_ALIAS[row.province] ?? row.province;
      const provinceCode = provinceCodeByName.get(provinceName);
      if (!provinceCode) {
        skipped.provinsi_tidak_dikenal.push({ name, nik, extra: row.province });
        continue;
      }

      const derived = passwordFromNik(nik);
      toInsert.push({
        nik,
        fullName: name.slice(0, 200),
        whatsapp: (row.phone ?? "").trim().slice(0, 20),
        birthDate,
        provinceCode,
        password: derived.ok ? derived.password : MUNAS_DEFAULT_PASSWORD,
      });
    }

    console.log(APPLY ? "MODE: APPLY (menulis)" : "MODE: DRY-RUN (tidak menulis)");
    console.log(`Total baris MUNAS: ${rows.length}`);
    console.log(`Siap diimpor     : ${toInsert.length}`);
    for (const [reason, list] of Object.entries(skipped)) {
      if (list.length === 0) continue;
      console.log(`Dilewati (${reason}): ${list.length}`);
      for (const item of list.slice(0, 5)) {
        console.log(`  - ${item.name} | ${item.nik}${item.extra ? ` | ${item.extra}` : ""}`);
      }
      if (list.length > 5) console.log(`  …dan ${list.length - 5} lainnya`);
    }

    if (!APPLY) {
      console.log("\nContoh 3 baris pertama yang akan masuk:");
      for (const r of toInsert.slice(0, 3)) {
        const p = provinceByCode.get(r.provinceCode);
        console.log(
          `  ${r.nik} | ${r.fullName} | ${r.birthDate.toISOString().slice(0, 10)} | ${p} | sandi ${r.password}`,
        );
      }
      console.log("\nJalankan ulang dengan --apply untuk menulis.");
      return;
    }

    // Sumber data dicatat sekali per impor; peserta hanya menyimpan id-nya.
    const munasSource = await ikadi.dataSource.upsert({
      where: { key: "munas-iv-2026" },
      create: {
        key: "munas-iv-2026",
        label: "MUNAS IV IKADI 2026",
        origin: "Database munas_ikadi, tabel participants",
        note: "Data tempat lahir, alamat, dan pekerjaan belum ada di sumber.",
      },
      update: {},
    });
    const munasSourceId = munasSource.id;

    let inserted = 0;
    for (const r of toInsert) {
      const passwordHash = await hashPassword(r.password);
      try {
        await ikadi.participant.create({
          data: {
            nik: r.nik,
            fullName: r.fullName,
            whatsapp: r.whatsapp,
            birthPlace: "",
            birthDate: r.birthDate,
            address: "",
            addressKtp: "",
            addressSameAsKtp: true,
            occupation: "",
            provinceCode: r.provinceCode,
            passwordHash,
            needsProfileCompletion: true,
            sourceId: munasSourceId,
          },
        });
        inserted++;
      } catch (err) {
        console.error(`Gagal memasukkan NIK ${r.nik}:`, err instanceof Error ? err.message : err);
      }
    }
    console.log(`\nSelesai. Dimasukkan: ${inserted} baris.`);
  } finally {
    await munas.$disconnect();
    await ikadi.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
