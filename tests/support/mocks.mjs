// In-memory stand-ins for "@/lib/prisma" and "@prisma/client".
// The alias loader swaps in these files when QA_MOCK=1 (set by npm run verify:qa).

// --- fake prisma: UNIQUE on nik is enforced, like the MySQL index ---
export const state = { rows: [], failNextCreateWith: null };

const p2002 = () =>
  Object.assign(new Error("Unique constraint failed on the fields: (`nik`)"), { code: "P2002" });

export const fakePrisma = {
  participant: {
    findUnique: async ({ where }) => {
      const r = state.rows.find((x) => x.nik === where.nik);
      return r ? { id: r.id } : null;
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
  },
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
}
