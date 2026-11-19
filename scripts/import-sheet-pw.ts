/**
 * Jadikan peserta pada sheet cetak KTA sebagai Pengurus Wilayah (level 2).
 *
 *   npx tsx scripts/import-sheet-pw.ts --file sheet.json           # dry-run
 *   npx tsx scripts/import-sheet-pw.ts --file sheet.json --apply    # menulis
 *
 * Sumber: sheet "cetak KTA" MUNAS IV. Setiap baris punya NIK dan kode PW
 * (mis. PW-JABAR). Aturan yang disepakati pemilik proyek:
 *
 * - Semua NIK 16 digit di sheet dijadikan PW, termasuk yang belum terdaftar.
 * - Yang sudah ada di `participants`: level dinaikkan ke 2, wilayah mengikuti
 *   kode PW, dan perubahan dicatat ke `membership_histories`.
 * - Yang belum ada: dibuat sebagai peserta baru dengan
 *   `needs_profile_completion = true`, sumber data sheet MUNAS, sandi awal
 *   `Munas` + DDMMYY dari NIK (sama seperti impor MUNAS).
 * - Kabupaten/kota diambil dari digit 3-4 NIK, hanya kalau kodenya ada di
 *   master untuk provinsi terpilih. Kalau tidak, dibiarkan kosong.
 * - `isPengurus` TIDAK diubah. Menu pengurus tetap hanya untuk yang dilantik
 *   lewat alur pengurus; ini murni jenjang keanggotaan.
 * - NIK duplikat di sheet dan NIK yang tanggalnya mustahil dilewati.
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

import { readFile } from "node:fs/promises";
import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/password";
import { MUNAS_DEFAULT_PASSWORD, birthDateFromNik, passwordFromNik } from "../lib/munas-password";
import { PROVINCES, REGENCIES } from "../lib/wilayah";

const APPLY = process.argv.includes("--apply");

/** Kode PW di sheet -> nama provinsi di master. */
const PW_PROVINCE: Record<string, string> = {
  "PW-ACEH": "Aceh",
  "PW-SUMUT": "Sumatera Utara",
  "PW-SUMBAR": "Sumatera Barat",
  "PW-RIAU": "Riau",
  "PW-JAMBI": "Jambi",
  "PW-SUMSEL": "Sumatera Selatan",
  "PW-BENGKULU": "Bengkulu",
  "PW-LAMPUNG": "Lampung",
  "PW-BABEL": "Kepulauan Bangka Belitung",
  "PW-KEPRI": "Kepulauan Riau",
  "PW-DKI": "DKI Jakarta",
  "PW-JABAR": "Jawa Barat",
  "PW-JATENG": "Jawa Tengah",
  "PW-DIY": "DI Yogyakarta",
  "PW-JATIM": "Jawa Timur",
  "PW-BANTEN": "Banten",
  "PW-BALI": "Bali",
  "PW-NTB": "Nusa Tenggara Barat",
  "PW-NTT": "Nusa Tenggara Timur",
  "PW-KALBAR": "Kalimantan Barat",
  "PW-KALTENG": "Kalimantan Tengah",
  "PW-KALSEL": "Kalimantan Selatan",
  "PW-KALTIM": "Kalimantan Timur",
  "PW-KALTARA": "Kalimantan Utara",
  "PW-SULUT": "Sulawesi Utara",
  "PW-SULTENG": "Sulawesi Tengah",
  "PW-SULSEL": "Sulawesi Selatan",
  "PW-SULTRA": "Sulawesi Tenggara",
  "PW-GORONTALO": "Gorontalo",
  "PW-SULBAR": "Sulawesi Barat",
  "PW-MALUKU": "Maluku",
  "PW-MALUT": "Maluku Utara",
  "PW-PAPUA": "Papua",
  "PW-PAPBAR": "Papua Barat",
  "PW-PAPSEL": "Papua Selatan",
  "PW-PAPGUN": "Papua Pegunungan",
  "PW-PBD": "Papua Barat Daya",
};

/** Sumber data sheet cetak KTA, terpisah dari impor MUNAS sebelumnya. */
const SOURCE_KEY = "munas-iv-2026-sheet";
const LEVEL_PENGURUS_WILAYAH = 2;

type SheetRow = { nik: string; nama: string; jab: string; pw: string };

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

async function main() {
  const file = argValue("--file");
  if (!file) throw new Error("Butuh --file <path ke sheet.json>");

  const rows = JSON.parse(await readFile(file, "utf8")) as SheetRow[];
  const provinceByName = new Map(PROVINCES.map((p) => [p.name, p.code]));
  const regencyKeys = new Set(REGENCIES.map((r) => `${r.provinceCode}${r.code}`));
  const currentYear = new Date().getFullYear();

  const invalid: string[] = [];
  const unknownPw: string[] = [];
  const badDate: string[] = [];
  const duplicate: string[] = [];

  const seen = new Set<string>();
  type Work = {
    nik: string;
    name: string;
    provinceCode: string;
    regencyCode: string | null;
    birthDate: Date;
    password: string;
    pw: string;
  };
  const work: Work[] = [];

  for (const row of rows) {
    const nik = (row.nik ?? "").trim();
    const name = (row.nama ?? "").trim();
    if (!/^\d{16}$/.test(nik)) {
      invalid.push(`${name} (${nik || "kosong"})`);
      continue;
    }
    if (seen.has(nik)) {
      duplicate.push(`${name} (${nik})`);
      continue;
    }
    seen.add(nik);

    const provinceName = PW_PROVINCE[(row.pw ?? "").trim()];
    if (!provinceName) {
      unknownPw.push(`${name} (${nik}) kode ${row.pw}`);
      continue;
    }
    const provinceCode = provinceByName.get(provinceName);
    if (!provinceCode) {
      unknownPw.push(`${name} (${nik}) provinsi ${provinceName} tidak ada di master`);
      continue;
    }

    const birthDate = birthDateFromNik(nik, currentYear);
    if (!birthDate) {
      badDate.push(`${name} (${nik})`);
      continue;
    }

    const derived = passwordFromNik(nik);
    const nikReg = nik.slice(2, 4);
    work.push({
      nik,
      name,
      provinceCode,
      regencyCode: regencyKeys.has(provinceCode + nikReg) ? nikReg : null,
      birthDate,
      password: derived.ok ? derived.password : MUNAS_DEFAULT_PASSWORD,
      pw: row.pw,
    });
  }

  const niks = work.map((w) => w.nik);
  const existing = await prisma.participant.findMany({
    where: { nik: { in: niks } },
    select: { id: true, nik: true, levelCode: true, provinceCode: true, regencyCode: true },
  });
  const byNik = new Map(existing.map((p) => [p.nik, p]));

  const toUpdate = work.filter((w) => byNik.has(w.nik));
  const toCreate = work.filter((w) => !byNik.has(w.nik));

  console.log(APPLY ? "MODE: APPLY" : "MODE: DRY-RUN");
  console.log(`baris sheet          : ${rows.length}`);
  console.log(`NIK valid & unik     : ${work.length}`);
  console.log(`sudah ada di DB      : ${toUpdate.length}`);
  console.log(`akan dibuat baru     : ${toCreate.length}`);
  console.log(`NIK bukan 16 digit   : ${invalid.length}`);
  console.log(`NIK duplikat di sheet: ${duplicate.length}`);
  console.log(`kode PW tak dikenal  : ${unknownPw.length}`);
  console.log(`tanggal NIK mustahil : ${badDate.length}`);
  for (const [label, list] of [
    ["NIK tidak valid", invalid],
    ["NIK duplikat", duplicate],
    ["kode PW tak dikenal", unknownPw],
    ["tanggal mustahil", badDate],
  ] as const) {
    if (!list.length) continue;
    console.log(`  ${label}: ${list.slice(0, 5).join("; ")}${list.length > 5 ? ` …dan ${list.length - 5} lagi` : ""}`);
  }

  const perProvince: Record<string, number> = {};
  for (const w of work) perProvince[w.provinceCode] = (perProvince[w.provinceCode] ?? 0) + 1;
  const nameByCode = new Map(PROVINCES.map((p) => [p.code, p.name]));
  console.log(
    "sebaran provinsi:",
    Object.entries(perProvince)
      .sort((a, b) => b[1] - a[1])
      .map(([code, count]) => `${nameByCode.get(code) ?? code}=${count}`)
      .join(", "),
  );

  if (!APPLY) {
    console.log("\nContoh 5 yang akan dibuat:");
    for (const w of toCreate.slice(0, 5)) {
      console.log(`  ${w.nik} | ${w.name} | ${w.pw} | ${w.birthDate.toISOString().slice(0, 10)} | ${w.password}`);
    }
    console.log("\nJalankan ulang dengan --apply untuk menulis.");
    return;
  }

  const source = await prisma.dataSource.upsert({
    where: { key: SOURCE_KEY },
    create: {
      key: SOURCE_KEY,
      label: "Sheet cetak KTA MUNAS IV 2026",
      origin: "Google Sheets cetak KTA, dipakai untuk menetapkan Pengurus Wilayah",
      note: "Jenjang dinaikkan ke Pengurus Wilayah; sandi awal Munas + DDMMYY dari NIK.",
    },
    update: {},
  });

  const actorKind = "admin";
  let promoted = 0;
  let created = 0;

  for (const w of toUpdate) {
    const current = byNik.get(w.nik)!;
    const nextReg = w.regencyCode;
    const levelChanged = current.levelCode !== LEVEL_PENGURUS_WILAYAH;
    const regionChanged =
      current.provinceCode !== w.provinceCode || current.regencyCode !== nextReg;

    if (!levelChanged && !regionChanged) continue;

    const history: { field: string; oldValue: string | null; newValue: string | null }[] = [];
    if (levelChanged) history.push({ field: "level", oldValue: String(current.levelCode), newValue: String(LEVEL_PENGURUS_WILAYAH) });
    if (regionChanged) {
      history.push({
        field: "wilayah",
        oldValue: `${current.provinceCode ?? "-"}/${current.regencyCode ?? "-"}`,
        newValue: `${w.provinceCode}/${nextReg ?? "-"}`,
      });
    }

    await prisma.participant.update({
      where: { id: current.id },
      data: {
        levelCode: LEVEL_PENGURUS_WILAYAH,
        provinceCode: w.provinceCode,
        regencyCode: nextReg,
        sourceId: source.id,
      },
    });
    await prisma.membershipHistory.createMany({
      data: history.map((h) => ({
        participantId: current.id,
        field: h.field,
        oldValue: h.oldValue,
        newValue: h.newValue,
        actorKind,
        actorId: null,
      })),
    });
    promoted++;
  }

  for (const w of toCreate) {
    const passwordHash = await hashPassword(w.password);
    try {
      await prisma.participant.create({
        data: {
          nik: w.nik,
          fullName: w.name.slice(0, 200),
          whatsapp: "",
          birthPlace: "",
          birthDate: w.birthDate,
          address: "",
          addressKtp: "",
          addressSameAsKtp: true,
          occupation: "",
          levelCode: LEVEL_PENGURUS_WILAYAH,
          provinceCode: w.provinceCode,
          regencyCode: w.regencyCode,
          passwordHash,
          needsProfileCompletion: true,
          sourceId: source.id,
        },
      });
      created++;
    } catch (err) {
      console.error(`Gagal membuat NIK ${w.nik}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`\nDinaikkan/diperbarui: ${promoted}`);
  console.log(`Dibuat baru         : ${created}`);
}

main()
  .catch((err) => {
    console.error("Gagal:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
