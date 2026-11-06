/**
 * Nomor anggota IKADI: `L.WW.DD.YY.NNNN`.
 * L = level (1..7), WW = kode provinsi, DD = kode kabupaten/kota,
 * YY = tahun mod 100, NNNN = serial 4 digit per (level, provinsi, kab/kota, tahun).
 * Terbit sekali, permanen — tidak pernah diubah setelah cetak.
 */

export const LEVEL_LABELS: Record<number, string> = {
  1: "Pusat",
  2: "Wilayah",
  3: "Daerah",
  4: "Cabang",
  5: "Ranting",
  6: "Anggota",
  7: "Purnabakti",
};

export function isValidLevel(level: number): boolean {
  return Number.isInteger(level) && level >= 1 && level <= 7;
}

const pad = (n: number, w: number) => String(n).padStart(w, "0");

/** Format nomor anggota lengkap dari komponen. Tidak menyentuh DB. */
export function formatMemberNumber(
  level: number,
  provinceCode: string,
  regencyCode: string,
  year: number,
  serial: number,
): string {
  return `${level}.${provinceCode}.${regencyCode}.${pad(year % 100, 2)}.${pad(serial, 4)}`;
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
    create: { ...input, lastSerial: 1 },
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
