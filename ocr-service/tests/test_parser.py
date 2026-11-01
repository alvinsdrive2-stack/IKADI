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
