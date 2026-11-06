-- AlterTable: kolom keanggotaan (login anggota, level, wilayah, nomor anggota)
-- Down migration (forward-only in prod). Manual rollback:
-- ALTER TABLE `participants`
--   DROP INDEX `uq_participants_member_number`, DROP INDEX `idx_participants_region`,
--   DROP COLUMN `password_hash`, DROP COLUMN `level_code`, DROP COLUMN `province_code`,
--   DROP COLUMN `regency_code`, DROP COLUMN `member_number`,
--   DROP COLUMN `member_number_issued_at`, DROP COLUMN `membership_status`;
ALTER TABLE `participants`
    ADD COLUMN `password_hash` VARCHAR(255) NULL AFTER `ktp_path`,
    ADD COLUMN `level_code` TINYINT NOT NULL DEFAULT 6 AFTER `password_hash`,
    ADD COLUMN `province_code` CHAR(2) NULL AFTER `level_code`,
    ADD COLUMN `regency_code` CHAR(2) NULL AFTER `province_code`,
    ADD COLUMN `member_number` VARCHAR(20) NULL AFTER `regency_code`,
    ADD COLUMN `member_number_issued_at` DATETIME(3) NULL AFTER `member_number`,
    ADD COLUMN `membership_status` ENUM('AKTIF', 'NONAKTIF', 'PURNABAKTI') NOT NULL DEFAULT 'AKTIF' AFTER `member_number_issued_at`,
    ADD UNIQUE INDEX `uq_participants_member_number` (`member_number`),
    ADD INDEX `idx_participants_region` (`province_code`, `regency_code`);

-- CreateTable: master wilayah
-- Down: DROP TABLE `regencies`; DROP TABLE `provinces`;
CREATE TABLE `provinces` (
    `code` CHAR(2) NOT NULL,
    `name` VARCHAR(100) NOT NULL,

    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `regencies` (
    `province_code` CHAR(2) NOT NULL,
    `code` CHAR(2) NOT NULL,
    `name` VARCHAR(120) NOT NULL,

    PRIMARY KEY (`province_code`, `code`),
    INDEX `idx_regencies_province` (`province_code`),
    CONSTRAINT `regencies_province_code_fkey` FOREIGN KEY (`province_code`) REFERENCES `provinces` (`code`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: penghitung seri nomor anggota
-- Down: DROP TABLE `member_number_sequences`;
CREATE TABLE `member_number_sequences` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `level_code` TINYINT NOT NULL,
    `province_code` CHAR(2) NOT NULL,
    `regency_code` CHAR(2) NOT NULL,
    `year` SMALLINT NOT NULL,
    `last_serial` SMALLINT UNSIGNED NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`),
    UNIQUE INDEX `uq_member_number_sequence` (`level_code`, `province_code`, `regency_code`, `year`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: riwayat cetak KTA (sekaligus kuota cetak global)
-- Down: DROP TABLE `kta_prints`;
CREATE TABLE `kta_prints` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `participant_id` BIGINT UNSIGNED NOT NULL,
    `member_number` VARCHAR(20) NOT NULL,
    `printed_by_admin_id` BIGINT UNSIGNED NOT NULL,
    `printed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`),
    INDEX `idx_kta_prints_printed_at` (`printed_at`),
    INDEX `idx_kta_prints_participant` (`participant_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
