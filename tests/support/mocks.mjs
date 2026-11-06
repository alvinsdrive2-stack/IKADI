// In-memory stand-ins for "@/lib/prisma" and "@prisma/client".
// The alias loader swaps in these files when QA_MOCK=1 (set by npm run verify:qa).
//
// Plain JavaScript on purpose: this file is loaded by `node` as-is, and node only
// type-strips .ts/.mts. A TypeScript annotation here is a SyntaxError.

// --- fake prisma: UNIQUE on nik is enforced, like the MySQL index ---
export const state = {
  rows: [],
  failNextCreateWith: null,
  // key: `${levelCode}.${provinceCode}.${regencyCode}.${year}` -> lastSerial
  sequences: new Map(),
  prints: [],
  // key -> { key, nama, jabatan, updatedAt }
  officials: new Map(),
};

const p2002 = () =>
  Object.assign(new Error("Unique constraint failed on the fields: (`nik`)"), { code: "P2002" });

// Master wilayah minimum: satu pasangan sah (16, 01).
const provinces = new Map([["16", { code: "16", name: "Sumatera Selatan" }]]);
const regencies = new Map([["16|01", { provinceCode: "16", code: "01", name: "Ogan Komering Ulu" }]]);

export const fakePrisma = {
  province: {
    findUnique: async ({ where }) => provinces.get(where.code) ?? null,
  },
  regency: {
    findUnique: async ({ where }) => {
      const k = `${where.provinceCode_code.provinceCode}|${where.provinceCode_code.code}`;
      return regencies.get(k) ?? null;
    },
  },
  participant: {
    findUnique: async ({ where }) => {
      if ("nik" in where) {
        const r = state.rows.find((x) => x.nik === where.nik);
        return r ?? null;
      }
      const id = where.id !== undefined ? BigInt(where.id) : null;
      const r = state.rows.find((x) => BigInt(x.id) === id);
      return r ?? null;
    },
    create: async ({ data }) => {
      if (state.failNextCreateWith) {
        const e = state.failNextCreateWith;
        state.failNextCreateWith = null;
        return Promise.reject(e);
      }
      // Mirrors the MySQL UNIQUE index (AC-06); the route's pre-check alone cannot win a race.
      if (state.rows.some((r) => r.nik === data.nik)) return Promise.reject(p2002());
      const row = { ...data, id: BigInt(state.rows.length + 1) };
      state.rows.push(row);
      return row;
    },
    update: async ({ where, data }) => {
      const id = BigInt(where.id);
      const r = state.rows.find((x) => BigInt(x.id) === id);
      if (!r) return Promise.reject(Object.assign(new Error("Record not found"), { code: "P2025" }));
      Object.assign(r, data);
      return r;
    },
  },
  // Kuota cetak KTA: sumber kebenaran = hitung baris `kta_prints` (kontrak E.4).
  ktaPrint: {
    count: async () => state.prints.length,
    create: async ({ data }) => {
      const row = { ...data, id: BigInt(state.prints.length + 1) };
      state.prints.push(row);
      return row;
    },
  },
  // Serial nomor anggota per (level, provinsi, kab/kota, tahun). Kontrak E.2: atomik.
  memberNumberSequence: {
    upsert: async ({ where, create, update }) => {
      const k = where.levelCode_provinceCode_regencyCode;
      const key = `${k.levelCode}.${k.provinceCode}.${k.regencyCode}.${k.year}`;
      const cur = state.sequences.get(key) ?? 0;
      const next = cur === 0 ? create.lastSerial : cur + update.lastSerial.increment;
      state.sequences.set(key, next);
      return { lastSerial: next };
    },
  },
  // Nama pejabat KTA (kta_officials). upsert per `key`.
  ktaOfficial: {
    findMany: async () => [...state.officials.values()],
    upsert: async ({ where, create, update }) => {
      const existing = state.officials.get(where.key);
      const row = existing
        ? { ...existing, ...update, updatedAt: new Date() }
        : { ...create, updatedAt: new Date() };
      state.officials.set(where.key, row);
      return row;
    },
  },
  // Dua bentuk seperti Prisma asli: $transaction(fn) dan $transaction([promises]).
  $transaction: async (arg) => (Array.isArray(arg) ? Promise.all(arg) : arg(fakePrisma)),
};

export const prisma = fakePrisma;

// --- fake @prisma/client: only the export the route needs ---
// `x instanceof PrismaClientKnownRequestError` is always false under
// node --experimental-transform-types (class extends Error{} loses the global), so tests
// feed a plain Error carrying code P2002 - the same shape the real client throws.
class PrismaClientKnownRequestError extends Error {}
Object.defineProperty(PrismaClientKnownRequestError, "name", { value: "PrismaClientKnownRequestError" });
export const Prisma = { PrismaClientKnownRequestError };

export function reset() {
  state.rows = [];
  state.failNextCreateWith = null;
  state.sequences = new Map();
  state.prints = [];
  state.officials = new Map();
}
