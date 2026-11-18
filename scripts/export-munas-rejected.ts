/**
 * Ekspor peserta MUNAS yang TIDAK masuk ke `ikadi` beserta alasannya.
 *
 *   npx tsx scripts/export-munas-rejected.ts
 *
 * Keluaran: `munas-ditolak-<tanggal>.csv` di root proyek. CSV dipakai (bukan
 * xlsx) supaya bisa dibuka Excel tanpa menambah dependensi, dengan BOM supaya
 * huruf beraksen tidak rusak.
 *
 * Aturan alasan HARUS sama dengan `scripts/import-munas-participants.ts`.
 * Kalau aturan impor berubah, ubah keduanya.
 */
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "node:fs";
import { birthDateFromNik } from "../lib/munas-password";

const MUNAS_URL = process.env.MUNAS_DATABASE_URL;

type MunasRow = {
  id: number;
  nik: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  position: string | null;
  province: string | null;
  region_name: string | null;
  region_code: string | null;
  created_at: Date | null;
};

const PROVINCE_ALIAS: Record<string, string> = {
  "Daerah Istimewa Yogyakarta (DIY)": "DI Yogyakarta",
  "Bangka Belitung": "Kepulauan Bangka Belitung",
};

/**
 * Apakah baris MUNAS ini sudah berhasil masuk saat impor?
 *
 * Impor menyimpan versi nama yang dipangkas 200 karakter, jadi perbandingan
 * memakai awalan 200 karakter dan penanda `needs_profile_completion`.
 */
function isImportResult(
  row: MunasRow,
  ikadi: { nik: string; fullName: string; needsProfileCompletion: boolean },
): boolean {
  if (!ikadi.needsProfileCompletion) return false;
  const a = (row.full_name ?? "").trim().slice(0, 200);
  const b = ikadi.fullName.trim().slice(0, 200);
  return a === b;
}

type Reason = {
  code: string;
  label: string;
  detail?: string;
};

/** CSV: escape kutip ganda, bungkus semua field, jaga baris baru tetap di dalam sel. */
function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

async function main() {
  if (!MUNAS_URL) throw new Error("MUNAS_DATABASE_URL belum di-set");

  // Argumen kedua PrismaMariaDb bukan opsi driver; SSL harus lewat query string.
  const munas = new PrismaClient({ adapter: new PrismaMariaDb(MUNAS_URL) });
  const ikadi = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL!) });

  try {
    const rows = await munas.$queryRawUnsafe<MunasRow[]>(
      `SELECT p.id, p.nik, p.fullName AS full_name, p.phone, p.email, p.position,
              r.province, r.name AS region_name, r.code AS region_code, p.createdAt AS created_at
         FROM participants p
         JOIN regions r ON r.id = p.regionId
        ORDER BY p.id ASC`,
    );

    const candidateNiks = rows
      .map((r) => (r.nik ?? "").trim())
      .filter((n) => /^\d{16}$/.test(n));

    const ikadiRows = await ikadi.participant.findMany({
      where: { nik: { in: candidateNiks } },
      select: { nik: true, fullName: true, needsProfileCompletion: true },
    });
    const ikadiByNik = new Map(ikadiRows.map((p) => [p.nik, p]));

    const provinces = await ikadi.province.findMany({ select: { name: true } });
    const provinceCodeByName = new Map(provinces.map((p) => [p.name, true]));

    const currentYear = new Date().getFullYear();
    const seenNik = new Map<string, number>();
    const rejected: { row: MunasRow; reason: Reason }[] = [];

    for (const row of rows) {
      const nik = (row.nik ?? "").trim();
      let reason: Reason | null = null;

      if (!/^\d{16}$/.test(nik)) {
        reason = nik === ""
          ? { code: "NIK_KOSONG", label: "NIK kosong di data MUNAS" }
          : { code: "NIK_BUKAN_16_DIGIT", label: `NIK bukan 16 digit (${nik.length} karakter)` };
      } else if (seenNik.has(nik)) {
        reason = {
          code: "NIK_DUPLIKAT_SUMBER",
          label: "NIK sama dengan baris lain di MUNAS",
          detail: `duplikat dari baris id ${seenNik.get(nik)}`,
        };
      } else if (ikadiByNik.has(nik) && !isImportResult(row, ikadiByNik.get(nik)!)) {
        reason = {
          code: "NIK_SUDAH_ADA",
          label: "NIK sudah terdaftar di IKADI",
          detail: "dilewati agar data lama tidak tertimpa",
        };
      } else {
        seenNik.set(nik, row.id);
        const birthDate = birthDateFromNik(nik, currentYear);
        if (!birthDate) {
          reason = {
            code: "TANGGAL_NIK_MUSTAHIL",
            label: "Tanggal lahir di NIK tidak valid",
            detail: `digit 7-12: ${nik.slice(6, 12)} (DDMMYY)`,
          };
        } else {
          const provinceName = row.province ? (PROVINCE_ALIAS[row.province] ?? row.province) : "";
          if (!provinceName) {
            reason = {
              code: "PROVINSI_KOSONG",
              label: "Provinsi kosong di data MUNAS",
              detail: `region: ${row.region_name ?? "-"}`,
            };
          } else if (!provinceCodeByName.has(provinceName)) {
            reason = {
              code: "PROVINSI_TIDAK_DIKENAL",
              label: "Provinsi tidak ada di master IKADI",
              detail: `"${row.province}" bukan wilayah anggota, atau provinsi baru`,
            };
          }
        }
      }

      if (reason) rejected.push({ row, reason });
    }

    const header = [
      "ID MUNAS",
      "Nama Lengkap",
      "NIK",
      "No. HP",
      "Email",
      "Jabatan",
      "Provinsi (MUNAS)",
      "Region (MUNAS)",
      "Kode Region",
      "Tanggal Daftar MUNAS",
      "Alasan Tidak Masuk",
      "Kode Alasan",
      "Detail",
    ];

    const lines = [header.map(csvCell).join(",")];
    for (const { row, reason } of rejected) {
      lines.push(
        [
          row.id,
          row.full_name,
          row.nik ?? "",
          row.phone ?? "",
          row.email ?? "",
          row.position ?? "",
          row.province ?? "",
          row.region_name ?? "",
          row.region_code ?? "",
          row.created_at ? new Date(row.created_at).toISOString().slice(0, 10) : "",
          reason.label,
          reason.code,
          reason.detail ?? "",
        ].map(csvCell).join(","),
      );
    }

    const stamp = new Date().toISOString().slice(0, 10);
    const file = `munas-ditolak-${stamp}.csv`;
    // BOM membuat Excel mendeteksi UTF-8 dengan benar.
    writeFileSync(file, "﻿" + lines.join("\r\n") + "\r\n", "utf8");

    console.log(`Total baris MUNAS : ${rows.length}`);
    console.log(`Tidak masuk       : ${rejected.length}`);
    const perReason = new Map<string, number>();
    for (const r of rejected) perReason.set(r.reason.code, (perReason.get(r.reason.code) ?? 0) + 1);
    for (const [code, n] of [...perReason].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${code.padEnd(24)} ${n}`);
    }
    console.log(`\nBerkas: ${file}`);
  } finally {
    await munas.$disconnect();
    await ikadi.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
