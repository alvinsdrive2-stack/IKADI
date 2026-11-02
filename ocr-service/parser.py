"""Parser KTP dari baris OCR. Terima list (bbox, text, score); pure function, unit-testable tanpa engine OCR."""
import difflib
import re
from datetime import date

PROVINCES = [
    "ACEH", "SUMATERA UTARA", "SUMATERA BARAT", "RIAU", "KEPULAUAN RIAU", "JAMBI",
    "SUMATERA SELATAN", "KEPULAUAN BANGKA BELITUNG", "BENGKULU", "LAMPUNG",
    "DKI JAKARTA", "JAWA BARAT", "JAWA TENGAH", "DI YOGYAKARTA", "JAWA TIMUR",
    "BANTEN", "BALI", "NUSA TENGGARA BARAT", "NUSA TENGGARA TIMUR",
    "KALIMANTAN BARAT", "KALIMANTAN TENGAH", "KALIMANTAN SELATAN",
    "KALIMANTAN TIMUR", "KALIMANTAN UTARA", "SULAWESI UTARA",
    "SULAWESI TENGAH", "SULAWESI SELATAN", "SULAWESI TENGGARA", "GORONTALO",
    "SULAWESI BARAT", "MALUKU", "MALUKU UTARA", "PAPUA", "PAPUA BARAT",
    "PAPUA BARAT DAYA", "PAPUA TENGAH", "PAPUA PEGUNUNGAN", "PAPUA SELATAN",
]


def _clean(text):
    return re.sub(r"\s+", " ", text.replace(":", " ")).strip()


# Typo label dari bacaan OCR nyata (PP-OCRv5 latin mobile salah baca
# "Pekerjaan" jadi "Pokerjaan" di foto KTP fisik).
LABEL_ALIASES = {
    "pekerjaan": ("pokerjaan",),
}


def _bbox_xy(bbox):
    """Poly 4 titik -> (x0, y0, x1, y1); None kalau bbox tidak tersedia/bentuk aneh."""
    if bbox is None:
        return None
    try:
        pts = [(float(p[0]), float(p[1])) for p in bbox]
    except (TypeError, ValueError, IndexError):
        return None
    if len(pts) < 2:
        return None
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)


def _group_rows(lines):
    """Gabung box yang sebaris visual (y-center berdekatan) jadi satu baris:
    teks join urut kiri-ke-kanan, bbox gabungan, score rata-rata.

    Layout KTP dua kolom (label kiri, nilai kanan) sering dipisah OCR jadi dua
    box; label "_find_label" butuh mereka menyatu. Baris tanpa bbox dilewat
    apa adanya (input sintetis/legacy).
    """
    geo, plain = [], []
    for bbox, text, score in lines:
        b = _bbox_xy(bbox)
        # jangan buang ":" di sini — fallback TTL memisah label/nilai dengan
        # kolon; pemakai lain membersihkan sendiri via _clean.
        (geo if b is not None else plain).append((b, re.sub(r"\s+", " ", text).strip(), float(score)))
    geo.sort(key=lambda it: ((it[0][1] + it[0][3]) / 2, it[0][0]))
    # Baris visual dibandingkan ke ANCHOR (box pertama row), bukan bbox gabungan:
    # bbox gabungan makin tinggi tiap merge -> threshold ikut membesar -> semua
    # row nyambung jadi satu (chain drift).
    rows = []  # (yc_anchor, h_anchor, bbox_gabungan, items)
    for b, text, score in geo:
        x0, y0, x1, y1 = b
        yc, h = (y0 + y1) / 2, max(y1 - y0, 1.0)
        if rows:
            ayc, ah, rb, ritems = rows[-1]
            if abs(yc - ayc) <= 0.6 * max(h, ah):
                nb = (min(rb[0], x0), min(rb[1], y0), max(rb[2], x1), max(rb[3], y1))
                rows[-1] = (ayc, ah, nb, ritems + [(x0, text, score)])
                continue
        rows.append((yc, h, b, [(x0, text, score)]))
    merged = []
    for _ayc, _ah, b, ritems in rows:
        ritems.sort(key=lambda it: it[0])
        text = " ".join(t for _x, t, _s in ritems if t)
        merged.append((b, text, _avg([s for _x, _t, s in ritems])))
    return [(None, t, s) for _b, t, s in plain] + merged


def _find_label(lines, label):
    """Cari baris yang diawali `label` (atau alias typonya). Return (index, nilai setelah label, score) atau None."""
    for prefix in (label.upper(),) + tuple(a.upper() for a in LABEL_ALIASES.get(label, ())):
        for i, (_bbox, text, score) in enumerate(lines):
            t = _clean(text).upper()
            if t.startswith(prefix):
                # Label kadang diikuti titik-titik ("Pekerjaan .. : X") sebelum nilai.
                value = _clean(t[len(prefix):]).lstrip(".:- ")
                if value:
                    return i, value, score
    return None


def _avg(scores):
    return sum(scores) / len(scores) if scores else 0.0


def parse_ktp(lines):
    """lines: list of (bbox, text, rec_score) dari engine OCR (bbox poly 4 titik).

    Return dict key -> {"value": str|None, "confidence": float 0..1}.
    Confidence = rec_score baris pembentuk field (rata-rata bila multi-baris); 0.0 kalau validasi gagal.
    """
    lines = _group_rows(list(lines))
    out = {
        k: {"value": None, "confidence": 0.0}
        for k in ("nik", "fullName", "birthPlace", "birthDate", "gender",
                  "bloodType", "addressKtp", "province", "city", "religion",
                  "maritalStatus", "occupation")
    }

    # NIK: 16 digit berurutan di baris mana pun (label KTP sering terpisah dari angkanya).
    for _bbox, text, score in lines:
        m = re.search(r"(\d{16})", text.replace(" ", ""))
        if m:
            out["nik"] = {"value": m.group(1), "confidence": float(score)}
            break

    hit = _find_label(lines, "nama")
    if hit:
        _, v, s = hit
        out["fullName"] = {"value": v.title(), "confidence": float(s)}

    hit = _find_label(lines, "tempat/tgl lahir") or _find_label(lines, "tempat tgl lahir")
    if hit:
        _, v, s = hit
        m = re.match(r"([A-Z .'\-]+?),?\s*(\d{2})[- ./](\d{2})[- ./](\d{4})", v)
        if m:
            place, dd, mm, yy = m.group(1).strip(" ,"), m.group(2), m.group(3), m.group(4)
            out["birthPlace"] = {"value": place.title(), "confidence": float(s)}
            try:
                date(int(yy), int(mm), int(dd))  # validasi kalender; gagal -> tanggal dibuang
                out["birthDate"] = {"value": f"{yy}-{mm}-{dd}", "confidence": float(s)}
            except ValueError:
                out["birthDate"] = {"value": None, "confidence": 0.0}
        else:
            out["birthPlace"] = {"value": v.title(), "confidence": float(s)}

    # Fallback TTL: label "Tempat/Tgl Lahir" sering tak terbaca di foto miring
    # ("Tempat:gE anlr") — cari baris berpola "tempat, dd-mm-yyyy" langsung.
    if not out["birthDate"]["value"]:
        for _bbox, text, score in lines:
            t = _clean(text).upper()
            if re.search(r"BERLAKU|SEUMUR|HINGGA", t):
                continue  # area ttd: "Berlaku Hingga SEUMUR HIDUP"
            # segmen setelah ":" terakhir = nilai, terbebas dari sisa label rusak
            seg = text.split(":")[-1] if ":" in text else text
            m = re.search(r"([A-Z .'\-]{3,}?),?\s*(\d{2})[- ./](\d{2})[- ./](\d{4})", seg.upper())
            if not m:
                continue
            place = m.group(1).strip(" ,")
            if re.match(r"^(KOTA|KABUPATEN|KAB)\b", place):
                continue  # "KOTA SURABAYA 18-03-2021" = tanggal terbit, bukan lahir
            # buang kata sisa label yang tak terbaca ("TEMPATGEANLR")
            place = " ".join(w for w in place.split() if not re.search(r"TEMPAT|TGL|LAHIR", w))
            if not place:
                continue
            try:
                date(int(m.group(4)), int(m.group(3)), int(m.group(2)))
            except ValueError:
                continue
            out["birthPlace"] = {"value": place.title(), "confidence": float(score)}
            out["birthDate"] = {"value": f"{m.group(4)}-{m.group(3)}-{m.group(2)}", "confidence": float(score)}
            break

    hit = _find_label(lines, "jenis kelamin")
    if hit:
        _, v, s = hit
        v_up = v.upper()
        if "LAKI" in v_up:
            out["gender"] = {"value": "LAKI_LAKI", "confidence": float(s)}
        elif "PEREMPUAN" in v_up:
            out["gender"] = {"value": "PEREMPUAN", "confidence": float(s)}

    # Golongan darah: label "Gol. Darah" sering terbaca "Bol/Ool/Gal Darah"
    # dan nempel di baris jenis kelamin. Salah baca nilai umum: 8→B, 0→O, 3/4→A.
    # Nilai valid di form: A/B/AB/O.
    for _bbox, text, score in lines:
        t = _clean(text).upper()
        m = re.search(r"[BGLO][A-Z .]*[BD]ARAH\s*\.?\s*:?\s*(.*)$", t)
        if not m:
            continue
        v = m.group(1)
        v = v.replace("8", "B").replace("0", "O").replace("3", "A").replace("4", "A")
        m2 = re.search(r"\b(AB|A|B|O)\b", v)
        if m2:
            out["bloodType"] = {"value": m2.group(1), "confidence": float(score)}
            break

    # Alamat: baris label + baris RT/RW/Kel/Kec berikutnya. Baris non-match
    # dilewati (foto miring bikin "RT/RW" terbaca "BTRW"), blok berhenti di
    # baris kecamatan — setelah itu area ttd (nama kota + tanggal terbit).
    hit = _find_label(lines, "alamat")
    if hit:
        i, v, s = hit
        parts = [v]
        scores = [float(s)]
        for _bbox, text, score in lines[i + 1:]:
            t = _clean(text).upper()
            if re.match(r"(RT|RW|KEL|DESA|KECAMATAN|KABUPATEN|KOTA)\b", t):
                parts.append(t)
                scores.append(float(score))
                if t.startswith("KECAMATAN"):
                    break
            elif re.search(r"\d{2,3}/\d{2,3}", t):
                # "BTRW 002/003" (label RT/RW salah baca menyatu) — ambil angkanya
                parts.append(re.search(r"\d{2,3}/\d{2,3}", t).group(0))
                scores.append(float(score))
        out["addressKtp"] = {"value": ", ".join(parts).title(), "confidence": _avg(scores)}

    hit = _find_label(lines, "agama")
    if hit:
        _, v, s = hit
        out["religion"] = {"value": v.title(), "confidence": float(s)}

    hit = _find_label(lines, "status perkawinan")
    if hit:
        _, v, s = hit
        v_up = v.upper()
        mapping = [("BELUM MENIKAH", "BELUM_MENIKAH"), ("BELUM KAWIN", "BELUM_MENIKAH"),
                   ("CERAI HIDUP", "CERAI_HIDUP"), ("CERAI MATI", "CERAI_MATI"),
                   ("MENIKAH", "SUDAH_MENIKAH"), ("KAWIN", "SUDAH_MENIKAH")]
        for needle, enum in mapping:
            if needle in v_up:
                out["maritalStatus"] = {"value": enum, "confidence": float(s)}
                break

    # Fallback status: label & nilai salah baca di foto miring
    # ("Status-Perkavirtan" / "BELUM KSAWIN") — cocokkan fuzzy ke nilai baku.
    if not out["maritalStatus"]["value"]:
        known = {"BELUM KAWIN": "BELUM_MENIKAH", "BELUM MENIKAH": "BELUM_MENIKAH",
                 "CERAI HIDUP": "CERAI_HIDUP", "CERAI MATI": "CERAI_MATI",
                 "MENIKAH": "SUDAH_MENIKAH", "KAWIN": "SUDAH_MENIKAH"}
        best = None
        for _bbox, text, score in lines:
            # label & nilai sering menyatu di satu baris ("Status-Perkavirtan:
            # BELUM KSAWIN") — pakai segmen setelah kolon terakhir kalau ada.
            seg = text.split(":")[-1] if ":" in text else text
            t = _clean(seg).upper().strip(".:- ")
            if len(t) < 5 or len(t) > 25:
                continue
            for k in known:
                r = difflib.SequenceMatcher(None, t, k).ratio()
                if r >= 0.8 and (best is None or r > best[0]):
                    best = (r, k, float(score))
        if best:
            out["maritalStatus"] = {"value": known[best[1]], "confidence": best[2]}

    # Provinsi & kota: header KTP biasanya "PROVINSI X" lalu "KABUPATEN/KOTA Y" di baris atas.
    for _bbox, text, score in lines[:6]:
        t = _clean(text).upper()
        m = re.match(r"^PROVINSI\s+(.+)$", t)
        if m and not out["province"]["value"]:
            out["province"] = {"value": m.group(1).title(), "confidence": float(score)}
            continue
        m = re.match(r"^(KABUPATEN|KOTA|KAB)\s+(.+)$", t)
        if m and not out["city"]["value"]:
            out["city"] = {"value": m.group(2).title(), "confidence": float(score)}

    # Fallback provinsi: cocokkan nama provinsi di teks mana pun.
    if not out["province"]["value"]:
        for _bbox, text, score in lines:
            t = _clean(text).upper()
            for p in PROVINCES:
                if p in t:
                    out["province"] = {"value": p.title(), "confidence": float(score)}
                    break
            if out["province"]["value"]:
                break

    # Fallback kota: "KABUPATEN/KOTA X" di mana pun.
    if not out["city"]["value"]:
        for _bbox, text, score in lines:
            t = _clean(text).upper()
            m = re.match(r"^(?:KABUPATEN/KOTA|KABUPATEN|KOTA|KAB)\s+(.+)$", t)
            if m:
                out["city"] = {"value": m.group(1).title(), "confidence": float(score)}
                break

    hit = _find_label(lines, "pekerjaan")
    if hit:
        _, v, s = hit
        v_up = v.upper().replace("TIDAKBEKERJA", "TIDAK BEKERJA")
        # Area stempel/ttd KTP (nama kota + tanggal) sering sebaris dengan nilai
        # pekerjaan — buang trailing nama kota yang sudah terdeteksi.
        city = out["city"]["value"]
        if city:
            v_up = re.sub(r",?\s*(KOTA|KABUPATEN|KAB)?\s*" + re.escape(city.upper()) + r"\s*$", "", v_up).strip()
        out["occupation"] = {"value": v_up.title(), "confidence": float(s)}

    # Validasi akhir: NIK wajib 16 digit, selain itu dibuang.
    if out["nik"]["value"] and not re.fullmatch(r"\d{16}", out["nik"]["value"]):
        out["nik"] = {"value": None, "confidence": 0.0}

    return out
