/**
 * Nomor anggota IKADI.
 *
 * Tersimpan (DB): `L.WW.DD.YY.NNNNN`
 *   L     = level 1..7, tetap disimpan supaya hierarki tidak hilang,
 *           tapi TIDAK ikut dicetak/ditampilkan.
 *   WW    = kode provinsi (2 digit)
 *   DD    = kode kabupaten/kota (2 digit)
 *   YY    = tahun pendaftaran mod 100
 *   NNNNN = serial 5 digit per (level, provinsi, kab/kota, tahun)
 *
 * Ditampilkan/dicetak: `WWDDYY.NNNNN` (contoh `160126.00100`).
 * Level dibuang dari tampilan; titik hanya sebelum 5 digit terakhir.
 *
 * Serial 00001–00099 dan serial berpola ("nomor cantik") Direservasi untuk
 * admin berikan manual saat pengajuan, jadi penerbitan otomatis mulai di 00100.
 * Terbit sekali, permanen.
 */

/**
 * Label jenjang 1..7, dipakai di kartu, profil, dan daftar.
 * Level 1..5 memang jenjang kepengurusan, jadi labelnya "Pengurus ...";
 * 6 anggota biasa, 7 purnabakti/mantan pengurus.
 */
export const LEVEL_LABELS: Record<number, string> = {
  1: "Pengurus Pusat",
  2: "Pengurus Wilayah",
  3: "Pengurus Daerah",
  4: "Pengurus Cabang",
  5: "Pengurus Ranting",
  6: "Anggota",
  7: "Purnabakti / Mantan Pengurus",
};

export function isValidLevel(level: number): boolean {
  return Number.isInteger(level) && level >= 1 && level <= 7;
}

const pad = (n: number, w: number) => String(n).padStart(w, "0");

/** Serial terendah untuk penerbitan otomatis. 1..99 disimpan untuk nomor cantik. */
export const SERIAL_FLOOR = 100;
/** Batas atas serial 5 digit. */
export const SERIAL_MAX = 99999;

/** Serial yang dianggap "cantik", hanya admin yang boleh memberikannya. */
export function isPrettySerial(serial: number): boolean {
  if (serial < SERIAL_FLOOR) return true;
  const s = pad(serial, 5);
  const semuaSama = /^(\d)\1{4}$/.test(s);
  const berulangDua = /^(\d{2})\1+$/.test(s);
  const berurutanNaik = "0123456789".includes(s);
  const berurutanTurun = "9876543210".includes(s);
  const nolDiBelakang = /^[1-9]0{3}$/.test(s) || /^[1-9]0{4}$/.test(s);
  return semuaSama || berulangDua || berurutanNaik || berurutanTurun || nolDiBelakang;
}

/** Format lengkap untuk DB. */
export function formatMemberNumber(
  level: number,
  provinceCode: string,
  regencyCode: string,
  year: number,
  serial: number,
): string {
  return `${level}.${provinceCode}.${regencyCode}.${pad(year % 100, 2)}.${pad(serial, 5)}`;
}

/**
 * Bentuk tampilan/cetak: buang digit level, titik hanya sebelum 5 digit terakhir.
 * `6.16.01.26.00100` -> `160126.00100`
 * Nomor lama 4 digit (`6.16.01.26.0001`) tetap tampil `160126.0001`.
 */
export function displayMemberNumber(stored: string): string {
  const parts = stored.split(".");
  if (parts.length < 2) return stored;
  const tanpaLevel = parts.slice(1);
  const serial = tanpaLevel.pop() ?? "";
  return `${tanpaLevel.join("")}${serial ? `.${serial}` : ""}`;
}

export type IssueNumberInput = {
  levelCode: number;
  provinceCode: string;
  regencyCode: string;
  year: number;
};

/**
 * Terbitkan nomor anggota baru secara atomik.
 * Pakai `prisma.$transaction` + upsert increment di `member_number_sequences`
 * supaya dua admin yang mencetak bersamaan tidak dapat serial sama.
 * `tx` = Prisma transaction client (dipass dari caller yang sudah membuka transaksi).
 *
 * Saat baris sequence baru dibuat, serial mulai di `SERIAL_FLOOR` sehingga
 * 00001–00099 tetap kosong untuk nomor cantik.
 */
export async function issueMemberNumber<Tx>(
  tx: Tx,
  input: IssueNumberInput,
): Promise<{ memberNumber: string; serial: number }> {
  const client = tx as {
    memberNumberSequence: {
      upsert(args: {
        where: { levelCode_provinceCode_regencyCode_year: IssueNumberInput };
        create: IssueNumberInput & { lastSerial: number };
        update: { lastSerial: { increment: number } };
      }): Promise<{ lastSerial: number }>;
    };
  };

  const row = await client.memberNumberSequence.upsert({
    where: {
      levelCode_provinceCode_regencyCode_year: {
        levelCode: input.levelCode,
        provinceCode: input.provinceCode,
        regencyCode: input.regencyCode,
        year: input.year,
      },
    },
    create: { ...input, lastSerial: SERIAL_FLOOR },
    update: { lastSerial: { increment: 1 } },
  });

  const serial = row.lastSerial;
  return {
    memberNumber: formatMemberNumber(
      input.levelCode,
      input.provinceCode,
      input.regencyCode,
      input.year,
      serial,
    ),
    serial,
  };
}
