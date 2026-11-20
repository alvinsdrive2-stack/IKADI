-- Sandi peserta direset ke tanggal lahir (DDMMYY) sehingga wajib diganti saat
-- login berikutnya. Penanda terpisah dari `needs_profile_completion` karena
-- pelengkapan profil bisa selesai tanpa mengganti sandi, dan sebaliknya.
-- Down: ALTER TABLE `participants` DROP COLUMN `must_change_password`;
ALTER TABLE `participants`
  ADD COLUMN `must_change_password` BOOLEAN NOT NULL DEFAULT false;
