-- AlterTable
-- Down migration (forward-only in prod). Manual rollback:
-- ALTER TABLE `participants`
--   DROP COLUMN `marital_status`, DROP COLUMN `blood_type`,
--   DROP COLUMN `address_ktp`, DROP COLUMN `address_current`, DROP COLUMN `address_same_as_ktp`,
--   DROP COLUMN `province`, DROP COLUMN `city`, DROP COLUMN `study_field`, DROP COLUMN `ktp_path`;
ALTER TABLE `participants`
    ADD COLUMN `marital_status` ENUM('BELUM_MENIKAH', 'SUDAH_MENIKAH', 'CERAI_HIDUP', 'CERAI_MATI') NULL AFTER `gender`,
    ADD COLUMN `blood_type` ENUM('A', 'B', 'AB', 'O', 'TIDAK_TAHU') NULL AFTER `marital_status`,
    ADD COLUMN `address_ktp` TEXT NULL AFTER `address`,
    ADD COLUMN `address_current` TEXT NULL AFTER `address_ktp`,
    ADD COLUMN `address_same_as_ktp` BOOLEAN NOT NULL DEFAULT false AFTER `address_current`,
    ADD COLUMN `province` VARCHAR(100) NULL AFTER `address_same_as_ktp`,
    ADD COLUMN `city` VARCHAR(100) NULL AFTER `province`,
    ADD COLUMN `study_field` VARCHAR(150) NULL AFTER `last_education`,
    ADD COLUMN `ktp_path` VARCHAR(255) NULL AFTER `photo_path`;
