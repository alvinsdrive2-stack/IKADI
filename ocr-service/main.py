"""FastAPI wrapper PaddleOCR untuk KTP. Jalan lokal saja: uvicorn main:app --host 127.0.0.1 --port 8001"""
import threading
import time

from fastapi import FastAPI, File, HTTPException, UploadFile

from parser import parse_ktp

app = FastAPI(title="OCR KTP IKADI")

MAX_BYTES = 10 * 1024 * 1024
THRESHOLD = 0.85

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

                _engine = PaddleOCR(lang="id")
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
    try:
        result = get_engine().ocr(raw, cls=True)
    except Exception as exc:  # Paddle gagal (format aneh, gambar korup)
        raise HTTPException(status_code=422, detail=f"OCR gagal: {exc}") from exc

    # PaddleOCR v3: [[{"transcription": str, "rec_score": float, "rec_polys": bbox}, ...]]
    # v2 lama: [[[bbox, (text, score)], ...]]
    lines = []
    if result and result[0]:
        for item in result[0]:
            if isinstance(item, dict):
                lines.append((item.get("rec_polys") or item.get("rec_boxes"),
                              item.get("transcription", ""), float(item.get("rec_score", 0.0))))
            else:
                bbox, (text, score) = item[0], item[1]
                lines.append((bbox, text, float(score)))

    fields = parse_ktp(lines)
    return {
        "ok": True,
        "fields": fields,
        "threshold": THRESHOLD,
        "engine": "paddleocr",
        "durationMs": int((time.monotonic() - start) * 1000),
    }
