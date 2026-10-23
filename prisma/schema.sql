-- Dump skema — Pendataan KTA IKADI
-- Import: mysql -u root -p ikadi < prisma/schema.sql
-- Padanan Prisma: prisma/schema.prisma + prisma/migrations/

-- CreateTable
-- Down migration (forward-only in prod). Manual rollback:
-- DROP TABLE `admins`;
-- DROP TABLE `participants`;
CREATE TABLE `participants` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `origin_type` ENUM('PW', 'PD') NOT NULL,
    `origin_name` VARCHAR(150) NOT NULL,
    `full_name` VARCHAR(200) NOT NULL,
    `nik` VARCHAR(16) NOT NULL,
    `birth_place` VARCHAR(120) NOT NULL,
    `birth_date` DATE NOT NULL,
    `address` TEXT NOT NULL,
    `whatsapp` VARCHAR(20) NOT NULL,
    `last_education` VARCHAR(100) NULL,
    `occupation` VARCHAR(150) NOT NULL,
    `expertise` TEXT NULL,
    `sermon_experience` ENUM('SERING', 'KADANG_KADANG', 'BELUM_PERNAH', 'LAINNYA') NOT NULL,
    `sermon_experience_other` VARCHAR(200) NULL,
    `organization_experience` TEXT NULL,
    `quran_reading` ENUM('TAJWID_BAIK', 'BIASA', 'TIDAK_LANCAR') NOT NULL,
    `training_reason` TEXT NOT NULL,
    `training_expectation` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `uq_participants_nik`(`nik`),
    INDEX `idx_participants_created_at`(`created_at`),
    INDEX `idx_participants_origin`(`origin_type`, `origin_name`),
    INDEX `idx_participants_full_name`(`full_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admins` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(100) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `admins_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
