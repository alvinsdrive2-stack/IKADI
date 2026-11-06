/**
 * Pemadatan nama untuk kartu KTA — ruang cetak terbatas, nama panjang
 * terpotong. Aturan:
 *
 * 1. Gelar (depan: H., Dr., KH., Prof. … / belakang: S.Pd., M.A., Lc.) TIDAK
 *    pernah disingkat atau dibuang.
 * 2. Nama akhir (kata terakhir sebelum gelar belakang) TIDAK pernah disingkat.
 * 3. Kata di antaranya boleh disingkat jadi inisial + titik.
 *
 * Contoh:
 *   "H. Ahmad Fauzi, S.Pd."        -> "H. A. Fauzi, S.Pd."
 *   "Dr. KH. Ahmad Zaini, M.A."    -> "Dr. KH. A. Zaini, M.A."
 *   "H. Abdul Rahman, Lc."         -> "H. A. Rahman, Lc."
 *   "Muhammad Rizky Ramadhan"      -> "M. R. Ramadhan"
 */

/** Gelar/honorifik di depan nama. Dibandingkan tanpa titik & huruf kecil. */
const GELAR_DEPAN = new Set([
  "h",
  "hj",
  "dr",
  "drs",
  "dra",
  "prof",
  "kh",
  "ust",
  "ustadz",
  "ustadzah",
  "ir",
  "ny",
  "tn",
  "khs",
]);

/** Potongan gelar belakang yang sering dipakai tanpa titik. */
const GELAR_BELAKANG_TANPA_TITIK = new Set(["lc", "lcma", "ma", "mh", "mm", "se", "sh", "st", "ssi", "mpd", "spd"]);

const bersih = (t: string) => t.replace(/[.,]/g, "").toLowerCase();

function isGelarDepan(token: string): boolean {
  return GELAR_DEPAN.has(bersih(token));
}

function isGelarBelakang(token: string): boolean {
  const t = token.replace(/,$/, "");
  if (!t) return false;
  // "S.Pd." / "M.A." / "Ph.D." — titik di tengah/akhir = gelar.
  if (t.includes(".")) return !isGelarDepan(t);
  return GELAR_BELAKANG_TANPA_TITIK.has(bersih(t));
}

/** Inisial: huruf pertama + titik. */
function inisial(word: string): string {
  const first = word.replace(/^[^\p{L}]/u, "").charAt(0);
  return first ? `${first.toUpperCase()}.` : word;
}

/** Ambang panjang: nama ≤ 23 karakter dibiarkan utuh, lebih dari itu dipadatkan. */
export const COMPACT_THRESHOLD = 23;

export function compactPersonName(raw: string): string {
  const value = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!value) return "";

  // Nama pendek: tidak perlu disingkat sama sekali.
  if (value.length <= COMPACT_THRESHOLD) return value;

  // Gelar belakang setelah koma pertama: "Ahmad Fauzi, S.Pd., M.Si."
  const comma = value.indexOf(",");
  const head = comma === -1 ? value : value.slice(0, comma).trim();
  const gelarBelakangKoma = comma === -1 ? "" : value.slice(comma).trim(); // sudah termasuk koma

  const tokens = head.split(" ").filter(Boolean);

  // 1. Gelar depan disimpan apa adanya.
  const depan: string[] = [];
  while (tokens.length > 0 && isGelarDepan(tokens[0])) {
    depan.push(tokens.shift()!);
  }

  // 2. Gelar belakang yang ditulis tanpa koma ("Ahmad Fauzi S.Pd.").
  const belakangTanpaKoma: string[] = [];
  while (tokens.length > 1 && isGelarBelakang(tokens[tokens.length - 1])) {
    belakangTanpaKoma.unshift(tokens.pop()!);
  }

  if (tokens.length === 0) return value;

  // 3. Nama akhir utuh, sisanya inisial. Nama tunggal dibiarkan utuh.
  const akhir = tokens.pop()!;
  const tengah = tokens.map(inisial);
  const inti = tengah.length === 0 ? akhir : [...tengah, akhir].join(" ");

  const belakang = gelarBelakangKoma || (belakangTanpaKoma.length ? ` ${belakangTanpaKoma.join(" ")}` : "");
  return `${[...depan, inti].join(" ").replace(/\s+/g, " ").trim()}${belakang}`;
}
