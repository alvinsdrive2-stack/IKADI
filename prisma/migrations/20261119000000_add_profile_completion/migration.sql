-- Penanda peserta hasil impor yang datanya belum lengkap dan wajib melengkapi
-- profil serta membuat sandi baru sebelum memakai layanan.
-- Down: ALTER TABLE `participants` DROP COLUMN `needs_profile_completion`;
ALTER TABLE `participants`
  ADD COLUMN `needs_profile_completion` BOOLEAN NOT NULL DEFAULT false;
