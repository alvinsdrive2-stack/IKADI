"""Parser KTP dari hasil PaddleOCR. Terima list baris (bbox, text, score); pure function, unit-testable tanpa Paddle."""
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


def _find_label(lines, label):
    """Cari baris yang diawali `label`. Return (index, nilai setelah label, score) atau None."""
    prefix = label.upper()
    for i, (_bbox, text, score) in enumerate(lines):
        t = _clean(text).upper()
        if t.startswith(prefix):
            value = _clean(t[len(prefix):])
            if value:
                return i, value, score
    return None


def _avg(scores):
    return sum(scores) / len(scores) if scores else 0.0


def parse_ktp(lines):
    """lines: list of (bbox, text, rec_score) dari PaddleOCR.

    Return dict key -> {"value": str|None, "confidence": float 0..1}.
    Confidence = rec_score baris pembentuk field (rata-rata bila multi-baris); 0.0 kalau validasi gagal.
    """
    out = {
        k: {"value": None, "confidence": 0.0}
        for k in ("nik", "fullName", "birthPlace", "birthDate", "gender",
                  "addressKtp", "province", "city", "religion",
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
        m = re.match(r"([A-Z .'\-]+?),?\s*(\d{2})[- ](\d{2})[- ](\d{4})", v)
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

    hit = _find_label(lines, "jenis kelamin")
    if hit:
        _, v, s = hit
        v_up = v.upper()
        if "LAKI" in v_up:
            out["gender"] = {"value": "LAKI_LAKI", "confidence": float(s)}
        elif "PEREMPUAN" in v_up:
            out["gender"] = {"value": "PEREMPUAN", "confidence": float(s)}

    # Alamat: baris label + baris RT/RW/Kel/Kec berikutnya (heuristik posisi berurutan).
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
            else:
                break
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

    hit = _find_label(lines, "pekerjaan")
    if hit:
        _, v, s = hit
        out["occupation"] = {"value": v.title(), "confidence": float(s)}

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

    # Validasi akhir: NIK wajib 16 digit, selain itu dibuang.
    if out["nik"]["value"] and not re.fullmatch(r"\d{16}", out["nik"]["value"]):
        out["nik"] = {"value": None, "confidence": 0.0}

    return out
