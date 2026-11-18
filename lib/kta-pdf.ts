/**
 * PDF minimal untuk kartu KTA: satu halaman JPEG per sisi, ukuran halaman
 * persis ukuran kartu (85,6 × 48,914 mm).
 *
 * Kenapa ditulis sendiri: proyek ini tidak memakai pustaka PDF, dan
 * dependensi baru tidak sepadan untuk tiga halaman gambar. Format yang dipakai
 * hanya subset kecil PDF 1.4 yang diterima semua pembaca.
 */

/** 1 pt = 1/72 inci. Kartu 85,6 mm → 242,65 pt. */
const MM_TO_PT = 72 / 25.4;
export const CARD_PT_W = +(85.6 * MM_TO_PT).toFixed(2);
export const CARD_PT_H = +((85.6 * 600) / 1050 * MM_TO_PT).toFixed(2);

type PdfPage = { jpeg: Buffer; width: number; height: number };

/**
 * Susun PDF dari daftar halaman JPEG (2 halaman per peserta: depan, belakang).
 * Gambar ditulis apa adanya (DCTDecode), jadi tidak ada re-encode.
 */
export function buildCardsPdf(pages: PdfPage[]): Buffer {
  const chunks: Buffer[] = [];
  const offsets: number[] = [];
  let length = 0;

  const push = (part: Buffer | string) => {
    const buf = typeof part === "string" ? Buffer.from(part, "latin1") : part;
    chunks.push(buf);
    length += buf.length;
  };
  const startObject = (n: number) => {
    offsets[n] = length;
    push(`${n} 0 obj\n`);
  };

  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");

  // 1 = catalog, 2 = pages, lalu per halaman: page, content, image.
  const pageIds = pages.map((_, i) => 3 + i * 3);
  startObject(1);
  push("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  startObject(2);
  push(`<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>\nendobj\n`);

  pages.forEach((page, i) => {
    const pageId = pageIds[i];
    const contentId = pageId + 1;
    const imageId = pageId + 2;

    startObject(pageId);
    push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${CARD_PT_W} ${CARD_PT_H}] ` +
        `/Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`,
    );

    // Gambar diskalakan penuh ke halaman: cm 242.65 0 0 138.66 0 0, lalu /Im0 Do.
    const content = `q\n${CARD_PT_W} 0 0 ${CARD_PT_H} 0 0 cm\n/Im0 Do\nQ\n`;
    startObject(contentId);
    push(`<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}endstream\nendobj\n`);

    startObject(imageId);
    push(
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`,
    );
    push(page.jpeg);
    push("\nendstream\nendobj\n");
  });

  const xrefStart = length;
  const maxId = 3 + pages.length * 3 - 1;
  let xref = `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
  for (let n = 1; n <= maxId; n++) {
    xref += `${String(offsets[n] ?? 0).padStart(10, "0")} 00000 n \n`;
  }
  push(xref);
  push(`trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);

  return Buffer.concat(chunks);
}

/** PDF satu peserta: halaman depan lalu belakang. */
export function buildParticipantPdf(front: Buffer, back: Buffer): Buffer {
  return buildCardsPdf([
    { jpeg: front, width: 1050, height: 600 },
    { jpeg: back, width: 1050, height: 600 },
  ]);
}
