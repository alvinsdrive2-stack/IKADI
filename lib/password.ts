import argon2 from "argon2";

/**
 * Password hashing terpisah dari lib/auth.ts supaya bisa di-import
 * di route tanpa menarik `next/headers` (iron-session + cookies), yang
 * bikin test route (node --test) gagal resolve modul.
 */
export function hashPassword(password: string) {
  return argon2.hash(password, { type: argon2.argon2id });
}

export function verifyPassword(hash: string, password: string) {
  return argon2.verify(hash, password).catch(() => false);
}
