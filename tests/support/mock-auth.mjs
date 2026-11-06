// In-memory stand-in for "@/lib/auth".
// Swapped in by the alias loader (QA_MOCK=1) so routes can call requireAdmin()/
// getAnggotaSession() without next/headers, which does not exist in node --test.

// Plain JavaScript on purpose: node loads this file as-is (no .ts type-stripping).
export const authState = {
  adminId: "1",
  username: "testadmin",
  anggotaParticipantId: null,
};

/** Admin session sama seperti lib/auth.ts: tanpa adminId -> 401. */
export async function requireAdmin() {
  if (!authState.adminId) {
    return {
      ok: false,
      response: Response.json(
        { ok: false, code: "UNAUTHORIZED", message: "Silakan login sebagai admin." },
        { status: 401 },
      ),
    };
  }
  return {
    ok: true,
    session: { adminId: authState.adminId, username: authState.username },
  };
}

/** Kembalikan authState ke kondisi awal (dipakai beforeEach tes). */
export function resetAuth() {
  authState.adminId = "1";
  authState.username = "testadmin";
  authState.anggotaParticipantId = null;
}

export async function readAdminSession() {
  return authState.adminId ? { adminId: authState.adminId, username: authState.username } : null;
}

export async function getAdminSession() {
  throw new Error("next/headers not available in test");
}

/** Fake anggota session: tracks participantId + save()/destroy(), like iron-session would. */
export async function getAnggotaSession() {
  return {
    get participantId() {
      return authState.anggotaParticipantId ?? undefined;
    },
    set participantId(v) {
      authState.anggotaParticipantId = v ?? null;
    },
    save: async () => {},
    destroy: () => {
      authState.anggotaParticipantId = null;
    },
  };
}

export async function readAnggotaSession() {
  return authState.anggotaParticipantId ? { participantId: authState.anggotaParticipantId } : null;
}

export async function requireAnggota() {
  const session = await readAnggotaSession();
  if (!session) {
    return {
      ok: false,
      response: Response.json(
        { ok: false, code: "UNAUTHORIZED", message: "Silakan login sebagai anggota." },
        { status: 401 },
      ),
    };
  }
  return { ok: true, session };
}

export const SESSION_COOKIE = "ikadi_admin";
export const ANGGOTA_COOKIE = "ikadi_anggota";
