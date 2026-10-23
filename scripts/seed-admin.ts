/**
 * Creates or updates the admin account from ADMIN_USERNAME / ADMIN_PASSWORD.
 * Usage: npm run db:seed
 */
import { config } from "dotenv";

// .env.local dulu (dipakai Next), lalu .env. dotenv tidak menimpa nilai yang sudah ada.
config({ path: ".env.local", quiet: true });
config({ quiet: true });

import { hashPassword } from "../lib/auth";
import { prisma } from "../lib/prisma";

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

  const passwordHash = await hashPassword(password);
  const admin = await prisma.admin.upsert({
    where: { username },
    create: { username, passwordHash },
    update: { passwordHash },
  });

  console.log(`Admin "${admin.username}" siap (id ${admin.id}).`);
}

main()
  .catch((err) => {
    // Never echo the password or hash.
    console.error("Seed admin gagal:", err instanceof Error ? err.message : "unknown error");
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
