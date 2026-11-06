"""Convert "DATA KTA IKADI.xlsx" (sheet "Data Fix") to idempotent MySQL INSERTs.

Usage:
    python -I scripts/import-data-fix.py "C:/Users/Alvia/Downloads/DATA KTA IKADI.xlsx" > data-fix.sql

Output: INSERT ... SELECT ... WHERE NOT EXISTS on nik (uq_participants_nik).
Duplicate person inside the file keeps the first occurrence; rows that fail
validation are reported on stderr and skipped.
"""
import datetime
import re
import sys
import unicodedata
import zipfile
from xml.sax.saxutils import escape

BULAN = {
    "januari": 1, "februari": 2, "pebruari": 2, "maret": 3, "april": 4,
    "mei": 5, "juni": 6, "juli": 7, "agustus": 8, "september": 9,
    "oktober": 10, "november": 11, "nopember": 11, "desember": 12,
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "jun": 6, "jul": 7,
    "agu": 8, "agt": 8, "aug": 8, "sep": 9, "sept": 9, "okt": 10, "oct": 10,
    "nov": 11, "des": 12, "dec": 12, "may": 5, "july": 7, "june": 6,
    "march": 3, "january": 1, "february": 2, "april_full": 4,
}


# ---------- xlsx ----------
def read_rows(path):
    z = zipfile.ZipFile(path)
    shared = [
        "".join(re.findall(r"<t[^>]*>(.*?)</t>", si, re.S))
        for si in re.findall(r"<si>(.*?)</si>", z.read("xl/sharedStrings.xml").decode(), re.S)
    ]
    sheet = z.read("xl/worksheets/sheet1.xml").decode()
    out = []
    for rnum, body in re.findall(r'<row[^>]*r="(\d+)"[^>]*>(.*?)</row>', sheet, re.S):
        row = {}
        for ref, attrs, inner in re.findall(r'<c r="([A-Z]+)\d+"([^>]*)>(.*?)</c>', body, re.S):
            v = re.search(r"<v>(.*?)</v>", inner, re.S)
            t = re.search(r"<t[^>]*>(.*?)</t>", inner, re.S)
            if 't="s"' in attrs and v:
                row[ref] = shared[int(v.group(1))]
            elif t:
                row[ref] = t.group(1)
            elif v:
                row[ref] = v.group(1)
        out.append((int(rnum), row))
    return out


# ---------- normalizers ----------
def clean(s):
    if s is None:
        return None
    s = "".join(ch for ch in s if ch.isprintable() or ch in "\n\t")
    s = re.sub(r"\s+", " ", s).strip().strip("'\"").strip()
    return s or None


def clean_text(s):
    s = clean(s)
    return re.sub(r"[ \t]*\n\s*", "\n", s) if s else None


def digits(s):
    return re.sub(r"\D", "", s or "")


def month_by_prefix(mo):
    """Last resort for misspelled month names ("Febuari", "July"). Unique 3-letter prefix match."""
    mo = re.sub(r"[^a-z]", "", (mo or "").lower())
    hits = {v for k, v in BULAN.items() if mo and k.startswith(mo[:3])}
    return hits.pop() if len(hits) == 1 else None


def norm_name(s):
    s = clean(s)
    return re.sub(r"[^a-z0-9]", "", unicodedata.normalize("NFKD", s or "").lower())


def split_birth(raw, nik):
    """Return (place, 'YYYY-MM-DD') or None. Place falls back to NIK province/city code."""
    fallback_place = f"NIK {nik[0:6]}" if len(nik) == 16 else "(tidak diisi)"
    raw = clean(raw)
    if not raw:
        return None
    # try longest tail first: "24-11-1990", "24/11/1990" then "24 11 1990"
    date_pat = (
        r"(?:(?P<y4>\d{4})[./-](?P<m4>\d{1,2})[./-](?P<d4>\d{1,2})"
        r"|(?P<d>\d{1,2})[\s.,/-]+(?P<m>[A-Za-z]+|\d{1,2})[\s.,/-]+(?P<y>\d{2,4}))"
    )
    matches = list(re.finditer(date_pat, raw))
    if not matches:
        return None
    m = matches[-1]
    place = clean(raw[: m.start()]) or fallback_place
    place = place.rstrip(" ,./-")
    if m.group("y4"):
        y, mo, d = m.group("y4"), int(m.group("m4")), int(m.group("d4"))
    else:
        d_raw, mo_raw, y = m.group("d"), m.group("m"), m.group("y")
        if not re.fullmatch(r"\d{1,2}", d_raw):
            return None
        y = y[-2:] if len(y) == 4 and not "1900" <= y <= "2026" else y
        if not re.fullmatch(r"\d{2}|\d{4}", y):
            return None
        d = d_raw
        if mo_raw.isdigit():
            mo = int(mo_raw)
        else:
            mo = BULAN.get(mo_raw.lower()) or month_by_prefix(mo_raw)
            if mo is None:
                return None
    y = int(y)
    y = y + 1900 if 31 <= y <= 99 else y + 2000 if y <= 30 else y
    d, mo = int(d), int(mo)
    if not (1 <= d <= 31 and 1 <= mo <= 12):
        return None
    if not 1900 <= y <= 2026:
        return None
    try:  # reject non-existent dates such as 1985-02-29
        datetime.date(y, mo, d)
    except ValueError:
        return None
    return place, f"{y:04d}-{mo:02d}-{d:02d}"


def norm_whatsapp(raw):
    s = re.sub(r"[^\d+]", "", clean(raw) or "")
    if s.startswith("+62"):
        s = "0" + s[3:]
    elif s.startswith("62"):
        s = "0" + s[2:]
    s = digits(s)
    if len(s) == 9:
        s = "0" + s
    return s[:20] or None


def map_origin(b):
    return "PW" if b and b.startswith("PW") and "PD" not in b else "PD"


def map_experience(v):
    v = (v or "").lower()
    if "kadang" in v:
        return "KADANG_KADANG"
    if "belum" in v:
        return "BELUM_PERNAH"
    if "sering" in v:
        return "SERING"
    return "LAINNYA"


def map_quran(v):
    v = (v or "").lower()
    if "tajwid" in v:
        return "TAJWID_BAIK"
    if "tidak" in v:
        return "TIDAK_LANCAR"
    return "BIASA"


# ---------- main ----------
def validate(r, rnum):
    nik, name = digits(r.get("D")), clean(r.get("E"))
    errs = []
    if not nik:
        errs.append("NIK kosong")
    elif not 8 <= len(nik) <= 16:
        errs.append(f"NIK tidak valid ({nik})")
    if not name:
        errs.append("nama kosong")
    bd = split_birth(r.get("F"), nik)
    if not bd:
        errs.append(f"tanggal lahir tidak terbaca ({clean(r.get('F'))})")
    elif not 1900 <= int(bd[1][:4]) <= 2026:
        errs.append(f"tahun lahir aneh ({bd[1]})")
    if not norm_whatsapp(r.get("H")):
        errs.append("no WA kosong")
    return errs, nik, name, bd


def main(path):
    rows = read_rows(path)[1:]
    seen_name, seen_nik, out, skipped = {}, {}, [], []

    for rnum, r in rows:
        if not r.get("E") and not r.get("D"):
            continue
        errs, nik, name, bd = validate(r, rnum)
        if not errs:
            key = norm_name(name)
            if key in seen_name:
                errs = [f"duplikat nama dengan baris {seen_name[key]}"]
            elif nik in seen_nik:
                errs = [f"duplikat NIK dengan baris {seen_nik[nik]}"]
            else:
                seen_name[key] = seen_nik[nik] = rnum
        if errs:
            skipped.append((rnum, name, "; ".join(errs)))
            continue

        place, bdate = bd
        out.append({
            "origin_type": map_origin(r.get("B")),
            "origin_name": (clean(r.get("C")) or "(tidak diisi)")[:150],
            "full_name": name[:200],
            "nik": nik,
            "birth_place": place[:120],
            "birth_date": bdate,
            "address": clean_text(r.get("G")) or "(tidak diisi)",
            "whatsapp": norm_whatsapp(r.get("H")),
            "last_education": (clean(r.get("I")) or "")[:100] or None,
            "occupation": (clean(r.get("J")) or "(tidak diisi)")[:150],
            "expertise": clean_text(r.get("K")),
            "sermon_experience": map_experience(r.get("L")),
            "organization_experience": clean_text(r.get("M")),
            "quran_reading": map_quran(r.get("N")),
            "training_reason": clean_text(r.get("O")) or "(tidak diisi)",
            "training_expectation": clean_text(r.get("P")) or "(tidak diisi)",
        })

    sys.stdout.reconfigure(encoding="utf-8", newline="\n")
    sys.stderr.reconfigure(encoding="utf-8", errors="backslashreplace")

    cols = list(out[0])

    def q(v):
        if v is None:
            return "NULL"
        return "'" + escape(str(v)).replace("\\", "\\\\").replace("'", "''") + "'"

    w = sys.stdout.write
    w("-- Auto-generated from DATA KTA IKADI.xlsx (sheet: Data Fix) by scripts/import-data-fix.py\n")
    w(f"-- {len(out)} insert(s), {len(skipped)} baris dilewati (lihat stderr).\n")
    w("-- Idempotent: baris dengan NIK yang sudah ada di tabel tidak di-insert.\n\n")
    w("SET NAMES utf8mb4;\nSTART TRANSACTION;\n\n")
    collist = ", ".join(f"`{c}`" for c in cols)
    for rec in out:
        vals = ", ".join(q(rec[c]) for c in cols)
        w(f"INSERT INTO `participants` ({collist})\n")
        w(f"SELECT {vals} FROM DUAL\n")
        w(f"WHERE NOT EXISTS (SELECT 1 FROM `participants` WHERE `nik` = {q(rec['nik'])});\n")
    w("\nCOMMIT;\n")

    sys.stderr.write(f"inserted={len(out)} skipped={len(skipped)}\n")
    for rnum, name, why in skipped:
        sys.stderr.write(f"  row {rnum} {name!r}: {why}\n")


if __name__ == "__main__":
    main(sys.argv[1])
