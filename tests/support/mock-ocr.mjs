// In-memory stand-in for "@/lib/ocr" (QA_MOCK=1). No network in tests.
class OcrUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = "OcrUnavailableError";
  }
}

export const ocrState = {
  failWith: null,
  result: null,
};

export function resetOcr() {
  ocrState.failWith = null;
  ocrState.result = {
    ok: true,
    fields: {
      nik: { value: "3576014241026002", confidence: 0.97 },
      fullName: { value: "H. Ahmad Fauzi", confidence: 0.91 },
      birthPlace: { value: "Sidoarjo", confidence: 0.88 },
      birthDate: { value: "1980-05-17", confidence: 0.74 },
      gender: { value: "LAKI_LAKI", confidence: 0.95 },
      bloodType: { value: "B", confidence: 0.83 },
      addressKtp: { value: "Jl. Raya No. 1, Rt/Rw 02/03, Kel/Desa Sukamaju, Kecamatan Taman", confidence: 0.62 },
      province: { value: "Jawa Timur", confidence: 0.9 },
      city: { value: "Sidoarjo", confidence: 0.85 },
      religion: { value: "Islam", confidence: 0.97 },
      maritalStatus: { value: "SUDAH_MENIKAH", confidence: 0.93 },
      occupation: { value: "Guru", confidence: 0.95 },
    },
    threshold: 0.85,
    engine: "rapidocr",
    durationMs: 12,
  };
}

export async function extractKtp() {
  if (ocrState.failWith) throw ocrState.failWith;
  return ocrState.result;
}

export { OcrUnavailableError };
