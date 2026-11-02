"""FastAPI wrapper RapidOCR (onnxruntime) untuk KTP. Jalan lokal saja: uvicorn main:app --host 127.0.0.1 --port 8001"""
import os
import sys
import threading
import time

import cv2
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
        "engine": "rapidocr",
        "durationMs": int((time.monotonic() - start) * 1000),
    }
