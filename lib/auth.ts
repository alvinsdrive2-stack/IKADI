import { cookies } from "next/headers";
import { getIronSession, unsealData, type SessionOptions } from "iron-session";
import { prisma } from "@/lib/prisma";
import { isPengurusLevel, type Actor } from "@/lib/pengurus";

export type AdminSession = { adminId?: string; username?: string };
export type AnggotaSession = { participantId?: string };

export const SESSION_COOKIE = "ikadi_admin";
export const ANGGOTA_COOKIE = "ikadi_anggota";

const ADMIN_TTL_SECONDS = 60 * 60 * 8; // 8 jam
const ANGGOTA_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 hari

export type SessionData = AdminSession;
export type AnggotaSessionData = AnggotaSession;

function adminOptions(): SessionOptions {
  return {
    cookieName: SESSION_COOKIE,
    password: process.env.SESSION_SECRET ?? "",
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ADMIN_TTL_SECONDS,
    },
  };
}

function anggotaOptions(): SessionOptions {
  return {
    cookieName: ANGGOTA_COOKIE,
    password: process.env.SESSION_SECRET ?? "",
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ANGGOTA_TTL_SECONDS,
    },
  };
}

export class ConfigError extends Error {}

function assertSecret() {
  const secret = process.env.SESSION_SECRET ?? "";
  if (secret.length < 32) {
    // iron-session minimum is 32 chars; fail loudly instead of booting with an empty key.
    throw new ConfigError("SESSION_SECRET harus diisi minimal 32 karakter");
  }
}

// ---- Admin session (perilaku lama, jangan diubah) ----

export async function getAdminSession() {
  assertSecret();
  return getIronSession<AdminSession>(await cookies(), adminOptions());
}

/** Returns session if logged in, else null. Catches config/decrypt errors as "not logged in". */
export async function readAdminSession(): Promise<AdminSession | null> {
  try {
    const session = await getAdminSession();
    return session.adminId ? session : null;
  } catch {
    return null;
  }
}

/**
 * Decrypts and validates the session cookie in the edge runtime (proxy.ts).
 * iron-session's seal/unseal is pure Web Crypto, so it runs where Prisma cannot.
 * Rejects any cookie that was not signed with SESSION_SECRET.
 */
export async function hasValidAdminSession(
  store: { get(name: string): { value: string } | undefined },
): Promise<boolean> {
  const cookie = store.get(SESSION_COOKIE)?.value;
  if (!cookie) return false;
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return false;
  try {
    const data = await unsealData<SessionData>(cookie, {
      password: secret,
      ttl: ADMIN_TTL_SECONDS,
    });
    return Boolean(data?.adminId);
  } catch {
    return false;
  }
}

/** For route handlers: returns 401 Response when unauthenticated. */
export async function requireAdmin(): Promise<
  { ok: true; session: AdminSession } | { ok: false; response: Response }
> {
  const session = await readAdminSession();
  if (!session) {
    return {
      ok: false,
      response: Response.json(
        { ok: false, code: "UNAUTHORIZED", message: "Silakan login sebagai admin." },
        { status: 401 },
      ),
    };
  }
  return { ok: true, session };
}

// ---- Anggota session (payload beda: participantId, bukan adminId) ----

export async function getAnggotaSession() {
  assertSecret();
  return getIronSession<AnggotaSession>(await cookies(), anggotaOptions());
}

export async function readAnggotaSession(): Promise<AnggotaSession | null> {
  try {
    const session = await getAnggotaSession();
    return session.participantId ? session : null;
  } catch {
    return null;
  }
}

/** Edge-runtime check for the anggota cookie. Rejects admin cookies (no participantId). */
export async function hasValidAnggotaSession(
  store: { get(name: string): { value: string } | undefined },
): Promise<boolean> {
  const cookie = store.get(ANGGOTA_COOKIE)?.value;
  if (!cookie) return false;
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return false;
  try {
    const data = await unsealData<AnggotaSessionData>(cookie, {
      password: secret,
      ttl: ANGGOTA_TTL_SECONDS,
    });
    return Boolean(data?.participantId);
  } catch {
    return false;
  }
}

/** For route handlers: returns 401 Response when anggota unauthenticated. */
export async function requireAnggota(): Promise<
  { ok: true; session: AnggotaSession } | { ok: false; response: Response }
> {
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

// ---- Pengurus (peran di dalam area anggota, bukan admin) ----

/**
 * Sesi anggota + verifikasi peran ke DB.
 *
 * `isPengurus` sengaja TIDAK disimpan di cookie: umur cookie 30 hari, jadi
 * pencabutan peran tidak akan langsung berlaku. DB selalu jadi sumber kebenaran.
 */
export async function readPengurus(): Promise<Actor | null> {
  const session = await readAnggotaSession();
  if (!session?.participantId) return null;
  if (!/^\d{1,20}$/.test(session.participantId)) return null;
  try {
    const p = await prisma.participant.findUnique({
      where: { id: BigInt(session.participantId) },
      select: { id: true, isPengurus: true, levelCode: true, provinceCode: true, regencyCode: true },
    });
    if (!p?.isPengurus || !isPengurusLevel(p.levelCode)) return null;
    return {
      participantId: String(p.id),
      levelCode: p.levelCode,
      provinceCode: p.provinceCode,
      regencyCode: p.regencyCode,
    };
  } catch {
    return null;
  }
}

/**
 * Guard route pengurus.
 * 401 = belum login sebagai anggota, 403 = login tapi bukan pengurus.
 */
export async function requirePengurus(): Promise<
  { ok: true; actor: Actor } | { ok: false; response: Response }
> {
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
  const actor = await readPengurus();
  if (!actor) {
    return {
      ok: false,
      response: Response.json(
        { ok: false, code: "FORBIDDEN", message: "Akun ini bukan pengurus." },
        { status: 403 },
      ),
    };
  }
  return { ok: true, actor };
}
