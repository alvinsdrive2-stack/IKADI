"""Test _parse_vlm_fields (normalisasi jawaban VLM) tanpa network."""
import pytest

from main import _parse_vlm_fields


def test_bentuk_nested():
    out = _parse_vlm_fields({"nik": {"value": "3578010603040003", "confidence": 0.9}})
    assert out["nik"] == {"value": "3578010603040003", "confidence": 0.9}
    assert out["fullName"] == {"value": None, "confidence": 0.0}


def test_bentuk_flat():
    out = _parse_vlm_fields({"nik": "3578010603040003", "province": "Jawa Timur"})
    assert out["nik"]["value"] == "3578010603040003"
    assert out["nik"]["confidence"] == 1.0  # tanpa confidence -> dianggap yakin
    assert out["province"]["value"] == "Jawa Timur"


def test_nik_tidak_16_digit_dibuang():
    out = _parse_vlm_fields({"nik": {"value": "357801060304000", "confidence": 0.99}})
    assert out["nik"]["value"] is None
    assert out["nik"]["confidence"] == 0.0


def test_enum_invalid_dibuang():
    out = _parse_vlm_fields({
        "gender": {"value": "LAKI", "confidence": 0.9},
        "bloodType": {"value": "AB-", "confidence": 0.9},
        "maritalStatus": {"value": "JOMBLO", "confidence": 0.9},
    })
    assert out["gender"]["value"] is None
    assert out["bloodType"]["value"] is None
    assert out["maritalStatus"]["value"] is None


def test_birth_date_format_salah_dibuang():
    out = _parse_vlm_fields({"birthDate": {"value": "06-03-2004", "confidence": 0.9}})
    assert out["birthDate"]["value"] is None


def test_null_dan_teks_sampah_dibuang():
    out = _parse_vlm_fields({
        "city": {"value": None, "confidence": 0.5},
        "occupation": {"value": "tidak terbaca", "confidence": 0.1},
        "religion": {"value": "  ", "confidence": 0.1},
    })
    assert out["city"]["value"] is None
    assert out["occupation"]["value"] is None
    assert out["religion"]["value"] is None


def test_confidence_di_clamp():
    out = _parse_vlm_fields({"nik": {"value": "3578010603040003", "confidence": 7}})
    assert out["nik"]["confidence"] == 1.0
