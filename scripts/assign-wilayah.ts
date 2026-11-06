/**
 * Isi provinceCode/regencyCode peserta lama dari teks yang sudah ada
 * (originName, lalu province/city). Default DRY RUN — tidak menulis apa pun.
 *
 *   npx tsx scripts/assign-wilayah.ts            # laporan saja
 *   npx tsx scripts/assign-wilayah.ts --apply    # tulis ke DB
 *
 * Sumber teks dicoba berurutan:
 *   1. originName  ("PD IKADI Kab. Banyuwangi", "PD Sukoharjo", "PW IKADI DIY")
 *   2. province + city (data form lama)
 *
 * Aturan: hanya menulis kalau pasangan (provinsi, kab/kota) ketemu TEPAT SATU
 * di master. Ambigu / tidak ketemu dibiarkan null dan dilaporkan.
 */
import { prisma } from "../lib/prisma.js";

const APPLY = process.argv.includes("--apply");

/** Kata yang tidak membantu pencocokan wilayah. */
const NOISE = [
  "PD IKADI", "PW IKADI", "IKADI", "DPD", "DPW", "PD", "PW",
  "KABUPATEN", "KAB.", "KAB", "KOTA", "KOTAMADYA", "DAERAH ISTIMEWA",
  "DAERAHISTIMEWA", "PROVINSI", "PROPINSI",
];

/** Alias nama provinsi yang tidak sama dengan nama di master. */
const PROVINCE_ALIAS: Record<string, string> = {
  "DKI JAKARTA": "Dki Jakarta",
  "DKI": "Dki Jakarta",
  "JAKARTA": "Dki Jakarta",
  "DIY": "Di Yogyakarta",
  "YOGYAKARTA": "Di Yogyakarta",
  "JOGJA": "Di Yogyakarta",
  "SUMUT": "Sumatera Utara",
  "SUMBAR": "Sumatera Barat",
  "SUMSEL": "Sumatera Selatan",
  "KALBAR": "Kalimantan Barat",
  "KALTIM": "Kalimantan Timur",
  "KALSEL": "Kalimantan Selatan",
  "KALTENG": "Kalimantan Tengah",
  "KALTARA": "Kalimantan Utara",
  "SULUT": "Sulawesi Utara",
  "SULTENG": "Sulawesi Tengah",
  "SULSEL": "Sulawesi Selatan",
  "SULTRA": "Sulawesi Tenggara",
  "SULBAR": "Sulawesi Barat",
  "NTB": "Nusa Tenggara Barat",
  "NTT": "Nusa Tenggara Timur",
  "BABEL": "Kepulauan Bangka Belitung",
  "KEPRI": "Kepulauan Riau",
};

/** Normalisasi teks jadi token kata kunci. */
function tokens(raw: string): string[] {
  let s = raw.toUpperCase();
  for (const n of NOISE) s = s.split(n).join(" ");
  return s
    .replace(/[^A-Z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function norm(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
}

/** Nama wilayah tanpa prefiks "Kabupaten"/"Kota". */
function bareName(name: string): string {
  return norm(name.replace(/^(KABUPATEN|KOTA|KAB\.?)\s+/i, ""));
}

type Hit = { provinceCode: string; regencyCode: string };

async function main() {
  const [provinces, regencies] = await Promise.all([
    prisma.province.findMany({ orderBy: { code: "asc" } }),
    prisma.regency.findMany({ orderBy: [{ provinceCode: "asc" }, { code: "asc" }] }),
  ]);

  const provinceByName = new Map<string, string>();
  for (const p of provinces) provinceByName.set(norm(p.name), p.code);

  const regenciesByProvince = new Map<string, typeof regencies>();
  for (const r of regencies) {
    const list = regenciesByProvince.get(r.provinceCode) ?? [];
    list.push(r);
    regenciesByProvince.set(r.provinceCode, list);
  }

  /** Cari provinsi dari teks bebas. */
  function findProvince(text: string): { code: string; how: string } | null {
    const n = norm(text);
    for (const [alias, name] of Object.entries(PROVINCE_ALIAS)) {
      if (n.includes(norm(alias))) {
        const code = provinceByName.get(norm(name));
        if (code) return { code, how: `alias ${alias}` };
      }
    }
    for (const p of provinces) {
      if (n.includes(norm(p.name))) return { code: p.code, how: `nama ${p.name}` };
    }
    // Nama provinsi yang dipecah tanpa "DAERAH ISTIMEWA" dsb.
    const t = tokens(text);
    for (const p of provinces) {
      const pt = tokens(p.name);
      if (pt.length > 0 && pt.every((w) => t.includes(w))) return { code: p.code, how: `token ${p.name}` };
    }
    return null;
  }

  /** Cari kab/kota: di dalam provinsi kalau diketahui, kalau tidak seluruh master.
   *  Skor = jumlah token nama kota/kab yang cocok; cuma yang skor tertinggi dipakai,
   *  jadi "Bengkulu Tengah" tidak ketangkep "Kota Bengkulu". */
  function findRegency(text: string, provinceCode: string | null): Hit[] {
    const t = tokens(text);
    const pool = provinceCode ? (regenciesByProvince.get(provinceCode) ?? []) : regencies;
    const up = text.toUpperCase();
    const wantsKota = /\bKOTA\b/.test(up) && !/\bKAB(UPATEN)?\b|\/KOTA/.test(up);
    const wantsKab = /\bKAB(UPATEN)?\b/.test(up) && !/\bKOTA\b/.test(up);

    let best = 0;
    const scored: Array<{ hit: Hit; score: number }> = [];
    for (const r of pool) {
      const rt = tokens(bareName(r.name));
      if (rt.length === 0) continue;
      if (!rt.every((w) => t.includes(w))) continue;
      // Penanda KAB/KOTA tertulis di teks harus cocok dengan nama di master.
      if (wantsKota && !/^KOTA\b/i.test(r.name)) continue;
      if (wantsKab && !/^KABUPATEN\b/i.test(r.name)) continue;
      scored.push({ hit: { provinceCode: r.provinceCode, regencyCode: r.code }, score: rt.length });
      best = Math.max(best, rt.length);
    }
    return scored.filter((s) => s.score === best).map((s) => s.hit);
  }

  function resolve(p: {
    originName: string;
    province: string | null;
    city: string | null;
  }): { hit: Hit | null; reason: string } {
    const candidates = [p.originName, [p.province, p.city].filter(Boolean).join(" ")]
      .map((s) => s.trim())
      .filter(Boolean);

    let provinceCode: string | null = null;
    let provinceHow = "";
    for (const c of candidates) {
      const prov = findProvince(c);
      if (prov) {
        provinceCode = prov.code;
        provinceHow = prov.how;
        break;
      }
    }

    for (const c of candidates) {
      const unique = new Map(
        findRegency(c, provinceCode).map((h) => [`${h.provinceCode}${h.regencyCode}`, h]),
      );
      if (unique.size === 1) {
        return {
          hit: [...unique.values()][0],
          reason: [provinceHow, "kab/kota cocok"].filter(Boolean).join(", "),
        };
      }
      if (unique.size > 1) {
        return { hit: null, reason: `ambigu: ${[...unique.keys()].join("/")}` };
      }
      // Coba tanpa batasan provinsi (teks mungkin pegang nama kab/kota saja).
      if (provinceCode) {
        const wide = new Map(
          findRegency(c, null).map((h) => [`${h.provinceCode}${h.regencyCode}`, h]),
        );
        if (wide.size === 1) {
          return { hit: [...wide.values()][0], reason: "kab/kota unik lintas provinsi" };
        }
        if (wide.size > 1) {
          return { hit: null, reason: `ambigu lintas provinsi: ${[...wide.keys()].join("/")}` };
        }
      }
    }
    return {
      hit: null,
      reason: provinceCode ? `provinsi ${provinceCode} ketemu, kab/kota tidak` : "tidak dikenali",
    };
  }

  const rows = await prisma.participant.findMany({
    where: { OR: [{ provinceCode: null }, { regencyCode: null }] },
    select: { id: true, fullName: true, originName: true, province: true, city: true },
    orderBy: { id: "asc" },
  });

  const planned: Array<{ id: bigint; hit: Hit }> = [];
  const unresolved: Array<{ id: bigint; originName: string; reason: string }> = [];

  for (const r of rows) {
    const { hit, reason } = resolve(r);
    if (hit) planned.push({ id: r.id, hit });
    else unresolved.push({ id: r.id, originName: r.originName, reason });
  }

  const regencyName = new Map(regencies.map((r) => [`${r.provinceCode}${r.code}`, r.name]));
  const provinceName = new Map(provinces.map((p) => [p.code, p.name]));

  console.log(`Peserta tanpa wilayah lengkap: ${rows.length}`);
  console.log(`Bisa diisi: ${planned.length}`);
  console.log(`Tidak bisa: ${unresolved.length}\n`);

  const perRegion = new Map<string, number>();
  for (const p of planned) {
    const key = p.hit.provinceCode + p.hit.regencyCode;
    perRegion.set(key, (perRegion.get(key) ?? 0) + 1);
  }
  console.log("Sebaran target (teratas):");
  for (const [key, n] of [...perRegion.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)) {
    const prov = key.slice(0, 2);
    console.log(`  ${prov} ${provinceName.get(prov) ?? "?"} / ${regencyName.get(key) ?? key} — ${n}`);
  }

  if (unresolved.length > 0) {
    console.log("\nTidak bisa dipetakan (contoh 30):");
    for (const u of unresolved.slice(0, 30)) {
      console.log(`  #${u.id} ${u.originName} — ${u.reason}`);
    }
  }

  if (!APPLY) {
    console.log("\nDRY RUN. Tidak ada yang ditulis. Jalankan dengan --apply untuk menerapkan.");
    return;
  }

  console.log(`\nMenulis ${planned.length} baris...`);
  let done = 0;
  for (const p of planned) {
    await prisma.participant.update({
      where: { id: p.id },
      data: { provinceCode: p.hit.provinceCode, regencyCode: p.hit.regencyCode },
    });
    done += 1;
  }
  console.log(`Selesai. ${done} peserta diperbarui.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
