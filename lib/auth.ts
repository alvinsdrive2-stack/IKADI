import argon2 from "argon2";
import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";

export type AdminSession = { adminId?: string; username?: string };

export const SESSION_COOKIE = "ikadi_admin";

const sessionOptions: SessionOptions = {
  cookieName: SESSION_COOKIE,
  password: process.env.SESSION_SECRET ?? "",
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  },
};

export class ConfigError extends Error {}

function assertSecret() {
  const secret = process.env.SESSION_SECRET ?? "";
  if (secret.length < 32) {
    // iron-session minimum is 32 chars; fail loudly instead of booting with an empty key.
    throw new ConfigError("SESSION_SECRET harus diisi minimal 32 karakter");
  }
}

export function hashPassword(password: string) {
  return argon2.hash(password, { type: argon2.argon2id });
}

export function verifyPassword(hash: string, password: string) {
  return argon2.verify(hash, password).catch(() => false);
}

export async function getAdminSession() {
  assertSecret();
  return getIronSession<AdminSession>(await cookies(), sessionOptions);
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
