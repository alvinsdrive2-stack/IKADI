/**
 * Koreksi wilayah peserta lama yang memakai kode Papua versi salah.
 *
 *   npx tsx scripts/fix-papua-region.ts            # dry-run
 *   npx tsx scripts/fix-papua-region.ts --apply    # menulis
 *
 * Latar belakang: master lama memakai 91 = "Papua Barat" dan 94 = "Papua",
 * padahal kode Kemendagri 91 = Papua, 92 = Papua Barat, dan pemekaran 2022
 * memakai 93 Papua Selatan, 94 Papua Tengah, 95 Papua Pegunungan,
 * 96 Papua Barat Daya. Akibatnya province_code/regency_code peserta Papua
 * menunjuk kabupaten yang salah.
 *
 * Aturan pemetaan, berurutan:
 * 1. Nama kabupaten lama dicocokkan ke nama kabupaten di master baru.
 * 2. Kalau nama tidak ketemu, kode provinsi diambil dari NIK (digit 1-2) dan
 *    kabupaten dari digit 3-4, hanya kalau kodenya ada di master baru.
 * 3. Kalau tetap tidak ketemu, wilayah dikosongkan supaya tidak menunjuk
 *    kabupaten yang salah. Peserta seperti itu tidak bisa cetak KTA sampai
 *    wilayahnya dilengkapi ulang.
 *
 * Nomor anggota TIDAK diubah: nomor terbit bersifat permanen dan halaman
 * verifikasi membacanya apa adanya dari tabel member_cards.
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

import { prisma } from "../lib/prisma";
import { PROVINCES, REGENCIES } from "../lib/wilayah";

const APPLY = process.argv.includes("--apply");

/** Kode kabupaten lama -> kode kabupaten baru, dicocokkan lewat nama. */
const OLD_KAB_TO_NEW: Record<string, string> = {
  "9101": "9203",
  "9102": "9208",
  "9103": "9207",
  "9104": "9206",
  "9105": "9202",
  "9106": "9602",
  "9107": "9671",
  "9108": "9603",
  "9109": "9604",
  "9110": "9605",
  "9111": "9211",
  "9112": "9212",
  "9171": "9671",
  "9401": "9301",
  "9402": "9501",
  "9403": "9171",
  "9404": "9401",
  "9408": "9105",
  "9409": "9106",
  "9410": "9403",
  "9411": "9402",
  "9412": "9404",
  "9413": "9302",
  "9414": "9303",
  "9415": "9304",
  "9416": "9503",
  "9417": "9502",
  "9418": "9504",
  "9419": "9110",
  "9420": "9111",
  "9426": "9115",
  "9427": "9119",
  "9428": "9120",
  "9429": "9508",
  "9430": "9507",
  "9431": "9505",
  "9432": "9506",
  "9433": "9405",
  "9434": "9406",
  "9435": "9407",
  "9436": "9408",
  "9471": "9171",
};

const PAPUA_CODES = new Set(["91", "92", "93", "94", "95", "96"]);

async function main() {
  const provinceCodes = new Set(PROVINCES.map((p) => p.code));
  const regencyKeys = new Set(REGENCIES.map((r) => `${r.provinceCode}${r.code}`));

  const rows = await prisma.participant.findMany({
    where: { provinceCode: { in: ["91", "94"] } },
    select: {
      id: true,
      nik: true,
      fullName: true,
      provinceCode: true,
      regencyCode: true,
    },
    orderBy: { id: "asc" },
  });

  type Change = {
    id: bigint;
    name: string;
    nik: string;
    from: string;
    to: string;
    how: string;
  };

  const changes: Change[] = [];
  let unchanged = 0;
  const cleared: string[] = [];

  for (const row of rows) {
    const oldKey = `${row.provinceCode ?? ""}${row.regencyCode ?? ""}`;
    let nextProv: string | null = null;
    let nextReg: string | null = null;
    let how = "";

    if (row.regencyCode && OLD_KAB_TO_NEW[oldKey]) {
      nextProv = OLD_KAB_TO_NEW[oldKey].slice(0, 2);
      nextReg = OLD_KAB_TO_NEW[oldKey].slice(2);
      how = "nama kabupaten";
    } else {
      const nik = (row.nik ?? "").trim();
      if (/^\d{16}$/.test(nik)) {
        const nikProv = nik.slice(0, 2);
        const nikReg = nik.slice(2, 4);
        if (PAPUA_CODES.has(nikProv) && regencyKeys.has(nikProv + nikReg)) {
          nextProv = nikProv;
          nextReg = nikReg;
          how = "NIK";
        }
      }
    }

    if (!nextProv) {
      const before = `${row.provinceCode ?? "-"}/${row.regencyCode ?? "-"}`;
      if (before === "-/-") {
        unchanged++;
        continue;
      }
      cleared.push(`${row.nik} ${row.fullName.slice(0, 32)} (${before})`);
      changes.push({ id: row.id, name: row.fullName, nik: row.nik, from: before, to: "-/-", how: "tidak terpetakan" });
      continue;
    }

    if (!provinceCodes.has(nextProv)) {
      throw new Error(`Kode provinsi ${nextProv} tidak ada di master`);
    }

    const before = `${row.provinceCode ?? "-"}/${row.regencyCode ?? "-"}`;
    const after = `${nextProv}/${nextReg}`;
    if (before === after) {
      unchanged++;
      continue;
    }
    changes.push({ id: row.id, name: row.fullName, nik: row.nik, from: before, to: after, how });
  }

  console.log(APPLY ? "MODE: APPLY" : "MODE: DRY-RUN");
  console.log(`peserta kode lama (91/94): ${rows.length}`);
  console.log(`akan berubah: ${changes.length} | sudah benar: ${unchanged} | dikosongkan: ${cleared.length}`);
  for (const c of changes) {
    console.log(`  ${c.nik.padEnd(17)} ${c.name.slice(0, 30).padEnd(30)} ${c.from} -> ${c.to}  [${c.how}]`);
  }

  if (!APPLY) {
    console.log("\nJalankan ulang dengan --apply untuk menulis.");
    return;
  }

  let done = 0;
  for (const c of changes) {
    const [p, r] = c.to.split("/");
    await prisma.participant.update({
      where: { id: c.id },
      data: {
        provinceCode: p === "-" ? null : p,
        regencyCode: r === "-" ? null : r,
      },
    });
    done++;
  }
  console.log(`\nDiperbarui: ${done}`);
}

main()
  .catch((err) => {
    console.error("Gagal:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
