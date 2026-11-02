"""OCR KTP: VLM (API Zhipu) utama + RapidOCR (onnxruntime) fallback lokal.

Jalan lokal saja: uvicorn main:app --host 127.0.0.1 --port 8001
VLM aktif kalau GLM_API_KEY diset dan model vision tersedia; selain itu
otomatis pakai RapidOCR lokal (data tidak keluar server).
"""
import base64
import json
import os
import re
import sys
import threading
import time

import cv2
import httpx
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from rapidocr import (
    EngineType,
    LangDet,
    LangRec,
    ModelType,
    OCRVersion,
    RapidOCR,
)

from parser import parse_ktp

app = FastAPI(title="OCR KTP IKADI")

MAX_BYTES = 10 * 1024 * 1024
THRESHOLD = 0.85
# OCR_DEBUG=1 -> tiap /extract mencetak baris mentah hasil OCR (teks + score)
# ke log service, buat tuning parser dari bacaan asli.
DEBUG = os.environ.get("OCR_DEBUG") == "1"

# VLM Zhipu. PENTING: harus key PLATFORM (open.bigmodel.cn / z.ai), bukan key
# coding plan — model coding plan text-only, image di-drop, model akan
# mengarang isi KTP (terverifikasi). glm-4v-flash: free tier, cepat.
GLM_API_KEY = os.environ.get("GLM_API_KEY", "")
GLM_BASE_URL = os.environ.get("GLM_BASE_URL", "https://open.bigmodel.cn/api/paas/v4")
GLM_VLM_MODEL = os.environ.get("GLM_VLM_MODEL", "glm-4v-flash")
VLM_TIMEOUT_S = float(os.environ.get("VLM_TIMEOUT_S", "20"))

FIELD_KEYS = ("nik", "fullName", "birthPlace", "birthDate", "gender", "bloodType",
              "addressKtp", "province", "city", "religion", "maritalStatus", "occupation")

VLM_PROMPT = """Baca foto KTP (Kartu Tanda Penduduk) Indonesia ini. Balas HANYA JSON valid tanpa markdown fence, schema persis:
{"nik": {"value": "16 digit atau null", "confidence": 0.0},
 "fullName": {"value": null, "confidence": 0.0},
 "birthPlace": {"value": null, "confidence": 0.0},
 "birthDate": {"value": "YYYY-MM-DD atau null", "confidence": 0.0},
 "gender": {"value": "LAKI_LAKI|PEREMPUAN|null", "confidence": 0.0},
 "bloodType": {"value": "A|B|AB|O|null", "confidence": 0.0},
 "addressKtp": {"value": "alamat lengkap s.d. kecamatan atau null", "confidence": 0.0},
 "province": {"value": null, "confidence": 0.0},
 "city": {"value": null, "confidence": 0.0},
 "religion": {"value": null, "confidence": 0.0},
 "maritalStatus": {"value": "BELUM_MENIKAH|SUDAH_MENIKAH|CERAI_HIDUP|CERAI_MATI|null", "confidence": 0.0},
 "occupation": {"value": null, "confidence": 0.0}}
confidence = keyakinan pembacaan 0.0-1.0. Field yang tidak terbaca jelas WAJIB null dengan confidence 0. DILARANG menebak atau mengarang."""

ENUMS = {
    "gender": {"LAKI_LAKI", "PEREMPUAN"},
    "bloodType": {"A", "B", "AB", "O"},
    "maritalStatus": {"BELUM_MENIKAH", "SUDAH_MENIKAH", "CERAI_HIDUP", "CERAI_MATI"},
}


def _parse_vlm_fields(data):
    """Normalisasi jawaban VLM ke format field service. Menerima bentuk
    {"k": {"value": v, "confidence": c}} maupun flat {"k": v}.
    Nilai enum/NIK/tanggal tak valid dibuang (null) — jangan percaya model."""
    out = {k: {"value": None, "confidence": 0.0} for k in FIELD_KEYS}
    for k in FIELD_KEYS:
        f = data.get(k)
        if isinstance(f, dict):
            v, c = f.get("value"), f.get("confidence")
        else:
            v, c = f, None
        if v is None:
            continue
        v = str(v).strip()
        if not v or v.lower() in ("null", "none", "tidak terbaca"):
            continue
        if k == "nik" and not re.fullmatch(r"\d{16}", v):
            continue
        if k == "birthDate" and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", v):
            continue
        if k in ENUMS and v not in ENUMS[k]:
            continue
        try:
            conf = float(c)
        except (TypeError, ValueError):
            conf = 1.0
        out[k] = {"value": v, "confidence": max(0.0, min(1.0, conf))}
    return out


async def vlm_extract(raw):
    """Kirim gambar ke VLM Zhipu, balikin fields ter-normalisasi; None kalau
    VLM tidak dikonfigurasi/gagal (pemanggil jatuh ke RapidOCR lokal)."""
    if not GLM_API_KEY:
        return None
    b64 = base64.b64encode(raw).decode()
    payload = {
        "model": GLM_VLM_MODEL,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
                {"type": "text", "text": VLM_PROMPT},
            ],
        }],
        "temperature": 0.1,
        "max_tokens": 1024,
    }
    async with httpx.AsyncClient(timeout=VLM_TIMEOUT_S) as client:
        r = await client.post(
            f"{GLM_BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {GLM_API_KEY}"},
            json=payload,
        )
        r.raise_for_status()
        content = r.json()["choices"][0]["message"]["content"]
    # model kadang membungkus dengan ```json ... ```
    content = re.sub(r"^```(json)?|```$", "", content.strip(), flags=re.M).strip()
    return _parse_vlm_fields(json.loads(content))

_engine = None
_engine_lock = threading.Lock()


def get_engine():
    """RapidOCR lazy-load: model diunduh saat request pertama, lalu di-cache."""
    global _engine
    if _engine is None:
        with _engine_lock:
            if _engine is None:
                # Benchmark KTP asli (foto fisik): PP-OCRv5 rec latin mobile
                # MENANG lawan rec ch server — dict zh merusak teks Latin
                # ("KATHOLK", spasi hilang) dan 2.5x lebih lambat (2.0s vs
                # 0.8s warm di CPU). Det mobile multi cukup untuk KTP.
                _engine = RapidOCR(
                    params={
                        "Det.engine_type": EngineType.ONNXRUNTIME,
                        "Det.lang_type": LangDet.MULTI,
                        "Det.model_type": ModelType.MOBILE,
                        "Det.ocr_version": OCRVersion.PPOCRV5,
                        "Det.limit_side_len": 1280,
                        "Det.limit_type": "max",
                        "Rec.engine_type": EngineType.ONNXRUNTIME,
                        "Rec.lang_type": LangRec.LATIN,
                        "Rec.model_type": ModelType.MOBILE,
                        "Rec.ocr_version": OCRVersion.PPOCRV5,
                        # Rendah: parser yang menyeleksi, jangan buang baris
                        # berguna (label/header) di tahap OCR.
                        "Global.text_score": 0.3,
                    }
                )
    return _engine


@app.get("/health")
async def health():
    return {"ok": True}


@app.post("/extract")
async def extract(file: UploadFile = File(...)):
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="File kosong")
    if len(raw) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Ukuran maksimal 10 MB")

    start = time.monotonic()
    img = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(
            status_code=422,
            detail="Gambar tidak bisa dibaca (korup atau bukan JPEG/PNG/WebP)",
        )

    # Jalur 1: VLM Zhipu (kalau dikonfigurasi) — akurat di foto miring/gelap.
    fields = None
    engine = "rapidocr"
    try:
        fields = await vlm_extract(raw)
        if fields is not None:
            engine = f"vlm:{GLM_VLM_MODEL}"
    except Exception as exc:
        print(f"[vlm-fallback] {type(exc).__name__}: {exc}", file=sys.stderr, flush=True)

    # Jalur 2: RapidOCR lokal — fallback saat VLM mati/tak dikonfigurasi.
    if fields is None:
        try:
            result = get_engine()(img)
        except Exception as exc:  # RapidOCR gagal (format aneh, gambar korup)
            raise HTTPException(status_code=422, detail=f"OCR gagal: {exc}") from exc

        # RapidOCR 3.x: result.boxes (N,4,2), result.txts, result.scores paralel;
        # None kalau tidak ada teks sama sekali.
        lines = []
        if result is not None and result.boxes is not None:
            for box, text, score in zip(result.boxes, result.txts, result.scores):
                lines.append((box, text, float(score)))

        if DEBUG:
            for _b, text, score in lines:
                print(f"[ocr-debug] {score:.2f} {text}", file=sys.stderr, flush=True)

        fields = parse_ktp(lines)

    return {
        "ok": True,
        "fields": fields,
        "threshold": THRESHOLD,
        "engine": engine,
        "durationMs": int((time.monotonic() - start) * 1000),
    }
