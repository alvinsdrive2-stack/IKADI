/**
 * Creates the admin account from ADMIN_USERNAME / ADMIN_PASSWORD if it does
 * not exist yet.
 * Usage: npm run db:seed
 *
 * Deliberately does NOT update an existing admin: the password in .env is a
 * bootstrap value, and the admin can change their own password from the
 * profile menu. Overwriting on every seed would silently revert that change
 * and make the change-password feature pointless.
 * To reset the password on purpose: `npm run db:seed -- --force`.
 */
import { config } from "dotenv";

// .env.local dulu (dipakai Next), lalu .env. dotenv tidak menimpa nilai yang sudah ada.
config({ path: ".env.local", quiet: true });
config({ quiet: true });

import { hashPassword } from "../lib/password";
import { prisma } from "../lib/prisma";

const FORCE = process.argv.includes("--force");

async function main() {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    console.error("ADMIN_USERNAME dan ADMIN_PASSWORD wajib diisi di .env");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("ADMIN_PASSWORD minimal 8 karakter");
    process.exit(1);
  }

  const existing = await prisma.admin.findUnique({ where: { username }, select: { id: true } });
  if (existing && !FORCE) {
    console.log(
      `Admin "${username}" sudah ada (id ${existing.id}), sandi tidak diubah. ` +
        "Pakai --force kalau memang mau mengembalikan sandi ke nilai di .env.",
    );
    return;
  }

  const passwordHash = await hashPassword(password);
  const admin = await prisma.admin.upsert({
    where: { username },
    create: { username, passwordHash },
    update: { passwordHash },
  });

  console.log(`Admin "${admin.username}" ${existing ? "diset ulang" : "dibuat"} (id ${admin.id}).`);
}

main()
  .catch((err) => {
    // Never echo the password or hash.
    console.error("Seed admin gagal:", err instanceof Error ? err.message : "unknown error");
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
