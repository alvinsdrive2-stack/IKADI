"""Test parser KTP dengan baris sintetis (bbox, text, score). Tidak butuh PaddleOCR."""
import pytest

from parser import parse_ktp


def line(text, score=0.95):
    return (None, text, score)


KTP = [
    line("PROVINSI JAWA TIMUR", 0.99),
    line("KABUPATEN SIDOARJO", 0.98),
    line("NIK : 3576014241026002", 0.97),
    line("Nama : H. AHMAD FAUZI", 0.95),
    line("Tempat/Tgl Lahir : SIDOARJO, 17-05-1980", 0.93),
    line("Jenis Kelamin : LAKI-LAKI", 0.96),
    line("Alamat : JL. RAYA NO. 1", 0.90),
    line("RT/RW : 02/03", 0.92),
    line("Kel/Desa : SUKAMAJU", 0.91),
    line("Kecamatan : TAMAN", 0.94),
    line("Agama : ISLAM", 0.97),
    line("Status Perkawinan : MENIKAH", 0.93),
    line("Pekerjaan : GURU", 0.95),
]


@pytest.fixture
def fields():
    return parse_ktp(KTP)


def test_nik(fields):
    assert fields["nik"]["value"] == "3576014241026002"
    assert 0.0 <= fields["nik"]["confidence"] <= 1.0


def test_nama(fields):
    assert fields["fullName"]["value"] == "H. Ahmad Fauzi"


def test_tempat_tgl_lahir(fields):
    assert fields["birthPlace"]["value"] == "Sidoarjo"
    assert fields["birthDate"]["value"] == "1980-05-17"


def test_gender(fields):
    assert fields["gender"]["value"] == "LAKI_LAKI"


def test_alamat_multibaris(fields):
    addr = fields["addressKtp"]["value"]
    assert "Jl. Raya No. 1" in addr
    assert "Kecamatan Taman" in addr
    # confidence = rata-rata 4 baris pembentuk (0.90+0.92+0.91+0.94)/4
    assert fields["addressKtp"]["confidence"] == pytest.approx(0.9175, abs=1e-6)


def test_provinsi_kota_header(fields):
    assert fields["province"]["value"] == "Jawa Timur"
    assert fields["city"]["value"] == "Sidoarjo"


def test_agama_status_pekerjaan(fields):
    assert fields["religion"]["value"] == "Islam"
    assert fields["maritalStatus"]["value"] == "SUDAH_MENIKAH"
    assert fields["occupation"]["value"] == "Guru"


def test_confidence_range_semua_field(fields):
    for key, f in fields.items():
        assert 0.0 <= f["confidence"] <= 1.0, key
        assert f["value"] is None or isinstance(f["value"], str), key


def test_nik_bukan_16_digit_dibuang():
    out = parse_ktp([line("NIK : 35760142410260", 0.99)])
    assert out["nik"]["value"] is None
    assert out["nik"]["confidence"] == 0.0


def test_tanggal_tidak_valid_dibuang_tempat_tetap():
    out = parse_ktp([line("Tempat/Tgl Lahir : SIDOARJO, 32-13-1980", 0.9)])
    assert out["birthPlace"]["value"] == "Sidoarjo"
    assert out["birthDate"]["value"] is None
    assert out["birthDate"]["confidence"] == 0.0


def test_belum_menikah():
    out = parse_ktp([line("Status Perkawinan : BELUM KAWIN", 0.9)])
    assert out["maritalStatus"]["value"] == "BELUM_MENIKAH"


def test_perempuan():
    out = parse_ktp([line("Jenis Kelamin : PEREMPUAN", 0.9)])
    assert out["gender"]["value"] == "PEREMPUAN"


def test_input_kosong():
    out = parse_ktp([])
    for f in out.values():
        assert f["value"] is None
        assert f["confidence"] == 0.0


def test_provinsi_fallback_tanpa_header():
    out = parse_ktp([line("JAWA TIMUR", 0.88)])
    assert out["province"]["value"] == "Jawa Timur"


def test_kota_fallback_di_baris_mana_pun():
    out = parse_ktp([line("x", 0.9), line("KOTA SURABAYA", 0.87)])
    assert out["city"]["value"] == "Surabaya"


# Kartu KTP fisik asli (foto, guilloche) — bacaan ideal dari kartu Surabaya.
KTP_FISIK = [
    line("PROVINSI JAWA TIMUR", 0.9),
    line("KOTA SURABAYA", 0.9),
    line("NIK : 3578010603040003", 0.85),
    line("Nama : ANANDA ALVIANSYAH PUTRA P.", 0.8),
    line("Tempat/Tgl Lahir : SURABAYA, 06-03-2004", 0.8),
    line("Jenis kelamin : LAKI-LAKI Gol. Darah : B", 0.8),
    line("Alamat : KEBRAON TEGAL NO. 22", 0.8),
    line("RT/RW : 002/001", 0.8),
    line("Kel/Desa : KEBRAON", 0.8),
    line("Kecamatan : KARANG PILANG", 0.8),
    line("Agama : KATHOLIK", 0.8),
    line("Status Perkawinan: BELUM KAWIN", 0.8),
    line("Pekerjaan .. : BELUM/TIDAK BEKERJA", 0.8),
    line("Kewarganegaraan: WNI", 0.8),
    line("Berlaku Hingga : SEUMUR HIDUP", 0.8),
]


def test_ktp_fisik_surabaya():
    out = parse_ktp(KTP_FISIK)
    assert out["nik"]["value"] == "3578010603040003"
    assert out["fullName"]["value"] == "Ananda Alviansyah Putra P."
    assert out["birthPlace"]["value"] == "Surabaya"
    assert out["birthDate"]["value"] == "2004-03-06"
    assert out["gender"]["value"] == "LAKI_LAKI"
    assert out["addressKtp"]["value"] is not None
    assert "Kebraon" in out["addressKtp"]["value"]
    assert out["province"]["value"] == "Jawa Timur"
    assert out["city"]["value"] == "Surabaya"
    assert out["religion"]["value"] == "Katholik"
    assert out["maritalStatus"]["value"] == "BELUM_MENIKAH"
    assert out["occupation"]["value"] == "Belum/Tidak Bekerja"


def test_pekerjaan_dengan_titik_titik():
    out = parse_ktp([line("Pekerjaan .. : GURU", 0.9)])
    assert out["occupation"]["value"] == "Guru"


def test_tanggal_pemisah_titik():
    out = parse_ktp([line("Tempat/Tgl Lahir : SURABAYA, 06.03.2004", 0.9)])
    assert out["birthDate"]["value"] == "2004-03-06"


# --- Kasus foto KTP fisik miring (bacaan RapidOCR nyata) ---

def bline(text, score, x0=0, y0=0, x1=100, y1=20):
    """Baris dengan bbox nyata (poly 4 titik) supaya _group_rows bekerja."""
    return ([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], text, score)


def test_gol_darah_sebaris_jenis_kelamin():
    out = parse_ktp([line("Jenis Kelamin : LAKI-LAKI Gol. Darah : B", 0.9)])
    assert out["bloodType"]["value"] == "B"


def test_gol_darah_typo_split_box():
    # foto fisik: label "Bol Barah" + nilai "3B" (AB) di box kanan sebaris
    lines = [
        bline("Bol Barah", 0.83, x0=380, y0=300, x1=480, y1=320),
        bline("3B", 0.53, x0=620, y0=300, x1=650, y1=318),
    ]
    out = parse_ktp(lines)
    assert out["bloodType"]["value"] == "AB"


def test_gol_darah_digit_salah_baca():
    out = parse_ktp([line("Gol Darah : 8", 0.9)])  # 8 = B salah baca
    assert out["bloodType"]["value"] == "B"
    out = parse_ktp([line("Gal.Darah:0", 0.9)])  # 0 = O
    assert out["bloodType"]["value"] == "O"


def test_ttl_fallback_label_rusak():
    out = parse_ktp([line("Tempat:gE anlr : SURABAYA, 06-03-2004", 0.88)])
    assert out["birthPlace"]["value"] == "Surabaya"
    assert out["birthDate"]["value"] == "2004-03-06"


def test_ttl_fallback_tanpa_kolon():
    out = parse_ktp([line("TEMPAT LAHIR SIDOARJO 17-05-1980", 0.9)])
    assert out["birthPlace"]["value"] == "Sidoarjo"
    assert out["birthDate"]["value"] == "1980-05-17"


def test_ttl_fallback_abaikan_baris_ttd():
    out = parse_ktp([line("KOTA SURABAYA 18-03-2021", 0.98)])
    assert out["birthDate"]["value"] is None


def test_status_fuzzy_nilai_salah_baca():
    out = parse_ktp([line("Status-Perkavirtan:", 0.82), line("BELUM KSAWIN", 0.84)])
    assert out["maritalStatus"]["value"] == "BELUM_MENIKAH"


def test_status_fuzzy_label_nilai_menyatu():
    # label & nilai satu baris setelah merge visual
    out = parse_ktp([line("Status-Perkavirtan: BELUM KSAWIN", 0.83)])
    assert out["maritalStatus"]["value"] == "BELUM_MENIKAH"


def test_alamat_rtrw_typo_tidak_memotong():
    lines = [
        line("Alamat : KEBRAONTEGAL NO 22", 0.94),
        line("BTRW", 0.70),
        line("002/003", 0.87),
        line("Kel/Besa : KEBRAON", 0.90),
        line("Kecamatan : KARANG PILANG", 0.95),
        line("KOTA SURABAYA", 0.98),  # area ttd — tidak boleh ikut
    ]
    out = parse_ktp(lines)
    addr = out["addressKtp"]["value"]
    assert "002/003" in addr
    assert "Kecamatan Karang Pilang" in addr
    assert "Kota Surabaya" not in addr


def test_alamat_rtrw_menyatu_dengan_label_typo():
    # "BTRW" & "002/003" menyatu satu baris setelah merge visual
    out = parse_ktp([line("Alamat : KEBRAONTEGAL NO 22", 0.94), line("BTRW 002/003", 0.78)])
    assert "002/003" in out["addressKtp"]["value"]


# --- Kasus KTP hasil scan PDF (bacaan nyata) ---

def test_nik_digit_empat_terbaca_plus():
    out = parse_ktp([line("IK : 127120040+660005", 0.95)])
    assert out["nik"]["value"] == "1271200404660005"


def test_nama_fallback_tanpa_label():
    lines = [
        line("IK : 1271200404660005", 0.89),
        line("IR PAMOSTANGHUTAGALUNG", 0.98),
        line("Tempat/Tgl Lahir : MEDAN, 04-04-1966", 0.88),
    ]
    out = parse_ktp(lines)
    assert out["fullName"]["value"] == "Ir Pamostanghutagalung"


def test_gender_fuzzy_nilai_salah_baca():
    out = parse_ktp([line("Jenis Kelamin : LAKE LAKT", 0.83)])
    assert out["gender"]["value"] == "LAKI_LAKI"


def test_provinsi_dari_kode_nik():
    out = parse_ktp([
        line("PROVINSI SUMATERA", 0.97),  # kepotong
        line("IK : 1271200404660005", 0.89),
    ])
    assert out["province"]["value"] == "Sumatera Utara"


def test_city_pilih_kandidat_terpanjang():
    out = parse_ktp([
        line("KOTA MEDA", 0.97),        # header kepotong
        line("KOTA MEDAN", 1.00),       # stempel lengkap
    ])
    assert out["city"]["value"] == "Medan"
