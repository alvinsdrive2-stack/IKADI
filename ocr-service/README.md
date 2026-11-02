# OCR KTP Service

Microservice Python (FastAPI) yang membaca foto KTP dan balikin field + confidence. Jalan lokal saja, tidak pernah diekspos ke publik — Next.js app yang memanggilnya.

Dua jalur, otomatis:

1. **VLM (utama, kalau `VLM_API_KEY` diset)** — provider OpenAI-compatible apa pun (default gateway yang terverifikasi vision passthrough). Akurat di foto miring/gelap. Dua jebakan key, dua-duanya sudah terverifikasi: (a) OpenRouter — pakai API key biasa dari [openrouter.ai/keys](https://openrouter.ai/keys); management/provisioning key cuma ngatur akun, chat completions balas `401 "User not found"`. (b) Z.ai — key coding plan text-only, image di-drop, model MENGARANG isi KTP; VLM vision Zhipu wajib key platform ([open.bigmodel.cn](https://open.bigmodel.cn) / z.ai `paas/v4`). (c) Gateway pihak ketiga — verifikasi dulu modelnya benar-benar multimodal: kirim KTP asli, cocokkan NIK/nama; jawaban rapi tapi salah = image di-drop (text-only).
2. **RapidOCR/onnxruntime (fallback lokal)** — PP-OCRv5 det mobile (multi) + rec latin mobile, tanpa data keluar server. Dipilih dari benchmark foto KTP fisik asli — rec latin mobile mengalahkan rec ch server (dict zh merusak teks Latin) dengan waktu warm ~0.8s di CPU.

## Variabel lingkungan VLM

| Env | Default | Keterangan |
|---|---|---|
| `VLM_API_KEY` | (kosong) | Key provider. Kosong = RapidOCR lokal saja. |
| `VLM_BASE_URL` | `https://api.ezkielyna.store/v1` | Endpoint OpenAI-compatible (terverifikasi vision passthrough). |
| `VLM_MODEL` | `deepseek-v4.1-flash-1017` | Model VLM. Di gateway default, `deepseek-v4-flash` (tanpa `.1`) balas JSON kosong — pakai yang `.1`. |
| `VLM_TIMEOUT_S` | `20` | Timeout VLM; lewat = fallback lokal. |

Jawaban VLM divalidasi ketat: NIK wajib 16 digit, `birthDate` `YYYY-MM-DD`, enum (`gender`/`bloodType`/`maritalStatus`) harus sesuai — nilai tak valid dibuang jadi `null`, bukan ditelan mentah.

## Setup

```bash
cd ocr-service
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
# source .venv/bin/activate
pip install -r requirements.txt
```

## Jalan

```bash
uvicorn main:app --host 127.0.0.1 --port 8001
```

Model RapidOCR diunduh otomatis saat request pertama (lazy init) — request pertama bakal lambat.

## Endpoint

### `GET /health`

```json
{"ok": true}
```

### `POST /extract` — `multipart/form-data`, field `file`

Maks 10 MB, JPEG/PNG/WebP. Balasan:

```json
{
  "ok": true,
  "fields": {
    "nik":          {"value": "3576014241026002", "confidence": 0.97},
    "fullName":     {"value": "H. Ahmad Fauzi",   "confidence": 0.91},
    "birthPlace":   {"value": "Sidoarjo",          "confidence": 0.88},
    "birthDate":    {"value": "1980-05-17",        "confidence": 0.74},
    "gender":       {"value": "LAKI_LAKI",         "confidence": 0.95},
    "addressKtp":   {"value": "Jl. Raya No. 1, ...", "confidence": 0.62},
    "province":     {"value": "Jawa Timur",        "confidence": 0.90},
    "city":         {"value": "Sidoarjo",          "confidence": 0.85},
    "religion":     {"value": "Islam",             "confidence": 0.97},
    "maritalStatus":{"value": "SUDAH_MENIKAH",     "confidence": 0.93},
    "occupation":   {"value": "Guru",              "confidence": 0.95}
  },
  "threshold": 0.85,
  "engine": "rapidocr",
  "durationMs": 900
}
```

- `confidence` 0..1 = rata-rata `rec_score` baris pembentuk field. Validasi gagal (NIK bukan 16 digit, tanggal kalender tidak valid) → `value: null`, `confidence: 0`.
- `religion` tidak punya kolom di DB — client boleh mengabaikannya.
- Error: `400` file kosong, `413` > 10 MB, `422` OCR gagal.

## Test parser (tanpa model)

```bash
python -m pytest tests/ -v
```

## Konfigurasi sisi Next.js

Set di `.env` aplikasi utama (bukan di sini):

- `OCR_SERVICE_URL` — default `http://127.0.0.1:8001`
- `OCR_TIMEOUT_MS` — default `20000`

Lihat `DEPLOY.md` untuk PM2.
