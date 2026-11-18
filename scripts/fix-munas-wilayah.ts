/**
 * Samakan wilayah peserta hasil impor MUNAS dengan data yang bisa diperiksa:
 *
 *   npx tsx scripts/fix-munas-wilayah.ts            # dry-run
 *   npx tsx scripts/fix-munas-wilayah.ts --apply    # menulis
 *
 * Urutan penentuan provinsi:
 * 1. Nama provinsi yang disebut di kolom `position` (mis. "PW IKADI Kalimantan
 *    Utara"). Ini sumber paling tepercaya karena ditulis pengurus sendiri.
 * 2. Kode provinsi pada NIK (digit 1-2).
 * 3. Wilayah region MUNAS (sudah tersimpan sebelumnya) sebagai cadangan.
 *
 * Kabupaten/kota selalu dari NIK (digit 3-4) dan hanya dipakai kalau kodenya
 * benar-benar ada di master untuk provinsi terpilih.
 */
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const MUNAS_URL = process.env.MUNAS_DATABASE_URL;

/** Alias singkatan yang sering dipakai di jabatan. */
const POSITION_ALIASES: Record<string, string> = {
  JATENG: "Jawa Tengah",
  JATIM: "Jawa Timur",
  JABAR: "Jawa Barat",
  JATIM: "Jawa Timur",
  KALTIM: "Kalimantan Timur",
  KALBAR: "Kalimantan Barat",
  KALSEL: "Kalimantan Selatan",
  KALTARA: "Kalimantan Utara",
  SULSEL: "Sulawesi Selatan",
  SULTENG: "Sulawesi Tengah",
  SULTRA: "Sulawesi Tenggara",
  SULUT: "Sulawesi Utara",
  SUMBAR: "Sumatera Barat",
  SUMUT: "Sumatera Utara",
  SUMSEL: "Sumatera Selatan",
  NTB: "Nusa Tenggara Barat",
  NTT: "Nusa Tenggara Timur",
  DIY: "DI Yogyakarta",
  DKI: "DKI Jakarta",
  BABEL: "Kepulauan Bangka Belitung",
  KEPRI: "Kepulauan Riau",
};

type Row = { id: bigint; nik: string; full_name: string; position: string | null; province_code: string | null };

async function main() {
  if (!MUNAS_URL) throw new Error("MUNAS_DATABASE_URL belum di-set");

  const munas = new PrismaClient({ adapter: new PrismaMariaDb(MUNAS_URL) });
  const ikadi = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL!) });

  try {
    const rows = await munas.$queryRawUnsafe<Row[]>(
      `SELECT p.id, p.nik, p.fullName AS full_name, p.position, NULL AS province_code
         FROM participants p JOIN regions r ON r.id = p.regionId
        WHERE p.position LIKE '%PW%' ORDER BY p.id`,
    );

    const provinces = await ikadi.province.findMany({ select: { code: true, name: true } });
    const regencies = await ikadi.regency.findMany({ select: { provinceCode: true, code: true } });

    const provByCode = new Map(provinces.map((p) => [p.code, p.name]));
    const codeByName = new Map(provinces.map((p) => [p.name.toUpperCase(), p.code]));
    const regencyKeys = new Set(regencies.map((r) => `${r.provinceCode}${r.code}`));

    // Peserta impor di IKADI, dipetakan lewat NIK.
    const imported = await ikadi.participant.findMany({
      where: { sourceId: 1 },
      select: { id: true, nik: true, fullName: true, provinceCode: true, regencyCode: true },
    });
    const byNik = new Map(imported.map((p) => [p.nik, p]));

    const changes: {
      id: bigint;
      name: string;
      nik: string;
      from: string;
      to: string;
      how: string;
    }[] = [];
    let unchanged = 0;
    const unresolved: string[] = [];

    for (const row of rows) {
      const target = byNik.get(row.nik);
      if (!target) continue;

      const haystack = (row.position ?? "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ");
      let provCode: string | null = null;
      let provHow = "";

      // 1. Nama provinsi di jabatan (nama lengkap lebih dulu, lalu alias).
      for (const p of provinces) {
        const upper = p.name.toUpperCase();
        if (haystack.includes(upper)) {
          provCode = p.code;
          provHow = `jabatan "${p.name}"`;
          break;
        }
      }
      if (!provCode) {
        for (const [alias, name] of Object.entries(POSITION_ALIASES)) {
          if (new RegExp(`\\b${alias}\\b`).test(haystack)) {
            provCode = codeByName.get(name.toUpperCase()) ?? null;
            if (provCode) {
              provHow = `jabatan "${alias}"`;
              break;
            }
          }
        }
      }

      // 2. Kode provinsi pada NIK.
      if (!provCode) {
        const nikProv = row.nik.slice(0, 2);
        if (provByCode.has(nikProv)) {
          provCode = nikProv;
          provHow = `NIK digit 1-2 (${nikProv})`;
        }
      }

      // 3. Wilayah lama.
      if (!provCode && target.provinceCode && provByCode.has(target.provinceCode)) {
        provCode = target.provinceCode;
        provHow = "wilayah sebelumnya";
      }

      if (!provCode) {
        unresolved.push(`${row.full_name} (${row.nik})`);
        continue;
      }

      // Kabupaten/kota hanya diambil dari NIK kalau NIK-nya satu provinsi dengan
      // provinsi terpilih. Kalau berbeda (mis. lahir di DKI, menjabat di Bali),
      // kode kabupaten NIK tidak berlaku dan dibiarkan kosong.
      const nikProv = row.nik.slice(0, 2);
      const nikReg = row.nik.slice(2, 4);
      const regCode =
        nikProv === provCode && regencyKeys.has(`${provCode}${nikReg}`) ? nikReg : null;

      const provName = provByCode.get(provCode) ?? provCode;
      const before = `${target.provinceCode ?? "-"}/${target.regencyCode ?? "-"}`;
      const after = `${provCode}/${regCode ?? "-"}`;
      if (before === after) {
        unchanged++;
        continue;
      }
      changes.push({
        id: target.id,
        name: row.full_name,
        nik: row.nik,
        from: before,
        to: after,
        how: `${provHow}, kabupaten ${regCode ? "dari NIK" : "tidak ada di master"} (${provName})`,
      });
    }

    console.log(APPLY ? "MODE: APPLY" : "MODE: DRY-RUN");
    console.log(`peserta impor: ${imported.length} | baris PW: ${rows.length}`);
    console.log(`akan berubah : ${changes.length} | sudah benar: ${unchanged} | tak terpetakan: ${unresolved.length}`);
    for (const c of changes.slice(0, 15)) {
      console.log(`  ${c.nik} ${c.name.slice(0, 34).padEnd(34)} ${c.from} -> ${c.to}  [${c.how}]`);
    }
    if (changes.length > 15) console.log(`  ...dan ${changes.length - 15} lainnya`);
    if (unresolved.length) console.log("tak terpetakan:", unresolved.join("; "));

    if (!APPLY) {
      console.log("\nJalankan ulang dengan --apply untuk menulis.");
      return;
    }

    let done = 0;
    for (const c of changes) {
      const [provinceCode, regencyCode] = c.to.split("/");
      await ikadi.participant.update({
        where: { id: c.id },
        data: {
          provinceCode,
          regencyCode: regencyCode === "-" ? null : regencyCode,
        },
      });
      done++;
    }
    console.log(`\nDiperbarui: ${done}`);
  } finally {
    await munas.$disconnect();
    await ikadi.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
