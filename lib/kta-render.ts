/**
 * Renderer kartu KTA di server, dipakai ekspor massal (JPG/PDF).
 *
 * Sumber kebenaran tetap `lib/kta-layout.ts`, sumber yang sama dengan pratinjau
 * di layar. Bedanya di sini satuannya piksel: kartu dirender 1050 × 659 px,
 * rasio yang sama dengan artwork asli (1016 × 638), jadi 1% lebar = 10,5 px
 * dan ukuran huruf `size` (%) = `size × 10,5` px.
 *
 * Memakai satori lewat `next/og` (sudah jadi dependensi Next) + sharp untuk
 * JPEG. Tidak ada Chromium di server, jadi jangan ganti ke headless browser.
 */
import { ImageResponse } from "next/og";
import { createElement as h } from "react";
import type { ReactElement } from "react";
import { readFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import sharp from "sharp";
import { KTA_FACE_SRC, KTA_LAYOUT, type KtaBox } from "@/lib/kta-layout";
import { KTA_QR_COLOR } from "@/lib/kta";
import { compactPersonName } from "@/lib/person-name";
import { displayMemberNumber } from "@/lib/member-number";
import { publicBaseUrl, verifyPath } from "@/lib/base-url";

/**
 * Ukuran kanvas kartu.
 *
 * Rasio mengikuti artwork, bukan angka bulat: artwork depan dan belakang
 * sama-sama 1016 × 638 (1,5925). Kalau kanvas dipaksa 1,75, artwork harus
 * di-stretch (`fit: fill`) atau dipotong (`object-cover`) dan sisi belakang
 * jadi terlihat kepotong saat ekspor massal.
 */
export const CARD_W = 1050;
/** 1050 × 638 / 1016 = 659,35 → 659 (selisih 0,05%, tidak terlihat). */
export const CARD_H = 659;

const FONT_PATH = path.join(process.cwd(), "public", "fonts", "Eurostar", "eurostar.ttf");
/** Nama pemegang kartu memakai Exo 2 Bold, sama seperti pratinjau di layar. */
const NAME_FONT_PATH = path.join(process.cwd(), "public", "fonts", "Exo2", "exo2-700.ttf");

type Font = { name: string; data: Buffer; weight: 400 | 700; style: "normal" };

let cachedFonts: Font[] | null = null;
async function cardFonts(): Promise<Font[]> {
  if (!cachedFonts) {
    cachedFonts = [
      { name: "Eurostar", data: await readFile(FONT_PATH), weight: 400, style: "normal" },
      { name: "Exo 2", data: await readFile(NAME_FONT_PATH), weight: 700, style: "normal" },
    ];
  }
  return cachedFonts;
}

/** Aset artwork di-cache karena dipakai setiap kartu dalam satu ekspor. */
const artCache = new Map<string, string>();
async function artworkUri(face: "depan" | "belakang"): Promise<string> {
  const cached = artCache.get(face);
  if (cached) return cached;
  const abs = path.join(process.cwd(), "public", KTA_FACE_SRC[face].replace(/^\//, ""));
  // Kanvas sudah serasio dengan artwork (lihat CARD_H), jadi `fill` tidak
  // mengubah bentuk apa pun. Rasterisasi SVG dilakukan di densitas cukup
  // supaya tidak pecah saat 1050 px.
  const png = await sharp(await readFile(abs), { density: 200 })
    .resize(CARD_W, CARD_H, { fit: "fill" })
    .png()
    .toBuffer();
  const uri = `data:image/png;base64,${png.toString("base64")}`;
  artCache.set(face, uri);
  return uri;
}

export type CardInput = {
  memberNumber: string;
  fullName: string;
  levelLabel: string;
  provinceName: string | null;
  regencyName: string | null;
  /** Path relatif pas foto ("uploads/participants/12.jpg") atau null. */
  photoPath: string | null;
  /** Sumber terverifikasi untuk QR; basis URL diambil dari env. */
  request: Request;
};

function box(b: KtaBox): Record<string, string> {
  return {
    position: "absolute",
    left: `${b.x}%`,
    top: `${(b.y / 100) * CARD_H}px`,
    // Persen, bukan px: satori menolak lebar px pada sebagian elemen flex.
    width: `${b.w}%`,
    ...(b.align === "center" ? { marginLeft: `${-b.w / 2}%` } : {}),
  };
}

/** Sisi kotak QR dalam piksel render; 1% lebar kartu = 10,5 px. */
const QR_BOX_PX = Math.round((KTA_LAYOUT.qrVerifikasi.w / 100) * CARD_W);
/** 6% padding seperti pratinjau, tapi dihitung dari sisi kotak QR. */
const QR_PADDING_PX = Math.round(QR_BOX_PX * 0.06);
/** Sisi gambar QR setelah dikurangi padding. */
const QR_INNER_PX = QR_BOX_PX - QR_PADDING_PX * 2;

/** Sudut membulat 1 mm pada kartu. */
const QR_RADIUS_PX = Math.round(CARD_W / 85.6);

/** Tinggi kotak foto = lebar × 17/13 (rasio pas foto 3×4). */
const PHOTO_H = ((KTA_LAYOUT.photo.w / 100) * CARD_W * 17) / 13;

/** Ukuran huruf slot: `size` adalah persen lebar kartu. */
function fontSize(b: KtaBox): string {
  return `${(b.size / 100) * CARD_W}px`;
}

type TextSlotExtra = {
  weight?: 400 | 500 | 700 | 800;
  /** Nama font; default Eurostar (font kartu). */
  family?: string;
  lineHeight?: number;
  /** Em, mengikuti `tracking-*` Tailwind di pratinjau. */
  letterSpacing?: string;
};

function textSlot(
  b: KtaBox,
  text: string,
  color: string,
  { weight = 400, lineHeight = 1.15, letterSpacing, family = "Eurostar" }: TextSlotExtra = {},
  key?: string,
): ReactElement | null {
  if (b.size === 0 || !text) return null;
  return h(
    "div",
    {
      key,
      style: {
        ...box(b),
        display: "flex",
        fontFamily: family,
        fontSize: fontSize(b),
        fontWeight: weight,
        color,
        lineHeight,
        ...(letterSpacing ? { letterSpacing } : {}),
        overflow: "hidden",
        whiteSpace: "nowrap",
      },
    },
    text,
  );
}

async function photoDataUri(photoPath: string | null): Promise<string | null> {
  if (!photoPath) return null;
  try {
    // Foto impor memakai URL absolut ke sistem sumber; foto lokal tetap dibaca
    // dari `public/`.
    const buf = /^https?:\/\//i.test(photoPath)
      ? Buffer.from(await (await fetch(photoPath, { signal: AbortSignal.timeout(10_000) })).arrayBuffer())
      : await readFile(path.join(process.cwd(), "public", photoPath.replace(/^\//, "")));
    // Foto apa pun di-resize supaya satori tidak menyeret gambar 5 MB.
    const jpg = await sharp(buf).resize(600, 785, { fit: "cover" }).jpeg({ quality: 88 }).toBuffer();
    return `data:image/jpeg;base64,${jpg.toString("base64")}`;
  } catch {
    // Berkas hilang: slot foto dilewati, sama seperti di pratinjau layar.
    return null;
  }
}

async function qrDataUri(memberNumber: string, request: Request): Promise<string> {
  const url = `${publicBaseUrl(request)}${verifyPath(memberNumber)}`;
  return QRCode.toDataURL(url, { width: 600, margin: 1, errorCorrectionLevel: "M", color: KTA_QR_COLOR });
}

/** Satu sisi kartu sebagai PNG 1050 × 659 (rasio artwork). */
export async function renderCardFace(
  card: CardInput,
  face: "depan" | "belakang",
): Promise<{ png: Buffer; verifyUrl: string }> {
  const art = await artworkUri(face);
  const fonts = await cardFonts();
  const L = KTA_LAYOUT;

  const children: ReactElement[] = [
    h("img", { key: "art", src: art, width: CARD_W, height: CARD_H, style: { position: "absolute", top: 0, left: 0 } }),
  ];

  if (face === "depan") {
    const photo = await photoDataUri(card.photoPath);
    const qr = await qrDataUri(card.memberNumber, card.request);
    const wilayah = [card.levelLabel, card.provinceName, card.regencyName].filter(Boolean).join(" | ");

    if (photo) {
      children.push(
        h("div", {
          key: "photo",
          style: {
            ...box(L.photo),
            height: `${PHOTO_H}px`,
            display: "flex",
            overflow: "hidden",
            borderRadius: "2px",
            backgroundColor: "#fff",
          },
        }, h("img", { src: photo, width: L.photo.w * 10.5, height: PHOTO_H })),
      );
    }

    const name = textSlot(
      L.fullName,
      compactPersonName(card.fullName),
      "#ffffff",
      // Pratinjau: Exo 2 Bold, leading-tight.
      { weight: 700, lineHeight: 1.25, family: "Exo 2" },
      "name",
    );
    if (name) children.push(name);

    const wilayahEl = textSlot(L.levelLabel, wilayah, "rgba(255,255,255,0.9)", {}, "wilayah");
    if (wilayahEl) children.push(wilayahEl);

    const number = textSlot(
      L.memberNumber,
      displayMemberNumber(card.memberNumber),
      "#ffffff",
      // Pratinjau: font-medium tracking-wider leading-none.
      { weight: 500, lineHeight: 1, letterSpacing: "0.05em" },
      "num",
    );
    if (number) children.push(number);

    // Padding sebagai piksel, bukan persen: satori menghitung padding persen
    // terhadap lebar induk (kartu), bukan kotak QR, hasilnya QR mengecil
    // jauh dibanding pratinjau. Pratinjau memakai 6% dari sisi kotak QR.
    children.push(
      h("div", {
        key: "qr",
        style: {
          ...box(L.qrVerifikasi),
          height: `${QR_BOX_PX}px`,
          display: "flex",
          backgroundColor: "#ffffff",
          borderRadius: `${QR_RADIUS_PX}px`,
          padding: `${QR_PADDING_PX}px`,
        },
      }, h("img", { src: qr, width: QR_INNER_PX, height: QR_INNER_PX })),
    );
  }

  const res = new ImageResponse(
    h("div", { style: { display: "flex", position: "relative", width: `${CARD_W}px`, height: `${CARD_H}px`, overflow: "hidden" } }, ...children),
    { width: CARD_W, height: CARD_H, fonts },
  );
  const png = Buffer.from(await res.arrayBuffer());
  return { png, verifyUrl: `${publicBaseUrl(card.request)}${verifyPath(card.memberNumber)}` };
}

/** JPEG dari satu sisi kartu, dipakai ekspor JPG (nama file di route). */
export async function renderCardJpeg(card: CardInput, face: "depan" | "belakang"): Promise<Buffer> {
  const { png } = await renderCardFace(card, face);
  return sharp(png).jpeg({ quality: 92, chromaSubsampling: "4:4:4" }).toBuffer();
}
