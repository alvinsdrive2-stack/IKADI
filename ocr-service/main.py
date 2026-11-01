"""FastAPI wrapper PaddleOCR untuk KTP. Jalan lokal saja: uvicorn main:app --host 127.0.0.1 --port 8001"""
import os
import sys
import threading
import time

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile

from parser import parse_ktp

app = FastAPI(title="OCR KTP IKADI")

MAX_BYTES = 10 * 1024 * 1024
THRESHOLD = 0.85
# OCR_DEBUG=1 -> tiap /extract mencetak baris mentah hasil OCR (teks + score)
# ke log service, buat tuning parser dari bacaan asli.
DEBUG = os.environ.get("OCR_DEBUG") == "1"

_engine = None
# PaddleX di balik PaddleOCR 3.x menolak inisialisasi ulang ("PDX has already
# been initialized"), jadi init wajib terjadi tepat sekali per proses: request
# bersamaan antre di lock (double-checked), bukan bikin engine kedua.
_engine_lock = threading.Lock()


def get_engine():
    """PaddleOCR lazy-load: berat, hanya diinisialisasi saat request pertama."""
    global _engine
    if _engine is None:
        with _engine_lock:
            if _engine is None:
                from paddleocr import PaddleOCR

                # Mobile det+rec: jauh lebih cepat dari default server di CPU
                # (target < 5 detik per KTP). enable_mkldnn=False: graph
                # executor OneDNN paddlepaddle 3.x melempar
                # "ConvertPirAttribute2RuntimeAttribute not support" di
                # sebagian CPU — jalankan tanpa MKLDNN.
                # text_det_limit: downscale sisi panjang ke 1280 sebelum deteksi.
                _engine = PaddleOCR(
                    lang="id",
                    text_detection_model_name="PP-OCRv5_mobile_det",
                    text_recognition_model_name="PP-OCRv5_mobile_rec",
                    text_det_limit_side_len=1280,
                    text_det_limit_type="max",
                    cpu_threads=8,
                    enable_mkldnn=False,
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
    # PaddleOCR 3.x predict() menerima ndarray, bukan bytes mentah.
    img = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(
            status_code=422,
            detail="Gambar tidak bisa dibaca (korup atau bukan JPEG/PNG/WebP)",
        )
    try:
        result = get_engine().predict(img)
    except Exception as exc:  # Paddle gagal (format aneh, gambar korup)
        raise HTTPException(status_code=422, detail=f"OCR gagal: {exc}") from exc

    # PaddleOCR 3.x: result = list per input; tiap item dict dengan rec_texts,
    # rec_scores, rec_polys yang paralel. Fallback v2: [[(bbox, (text, score)), ...]]
    lines = []
    page = result[0] if isinstance(result, (list, tuple)) and result else result
    if isinstance(page, dict) and "rec_texts" in page:
        for text, score, poly in zip(page["rec_texts"], page["rec_scores"], page["rec_polys"]):
            lines.append((poly, text, float(score)))
    else:
        for item in (page or []):
            if isinstance(item, dict):
                lines.append((item.get("rec_polys") or item.get("rec_boxes"),
                              item.get("transcription", ""), float(item.get("rec_score", 0.0))))
            else:
                bbox, (text, score) = item[0], item[1]
                lines.append((bbox, text, float(score)))

    if DEBUG:
        for _b, text, score in lines:
            print(f"[ocr-debug] {score:.2f} {text}", file=sys.stderr, flush=True)

    fields = parse_ktp(lines)
    return {
        "ok": True,
        "fields": fields,
        "threshold": THRESHOLD,
        "engine": "paddleocr",
        "durationMs": int((time.monotonic() - start) * 1000),
    }
