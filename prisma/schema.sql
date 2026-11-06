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
    `gender` ENUM('LAKI_LAKI', 'PEREMPUAN') NULL,
    `marital_status` ENUM('BELUM_MENIKAH', 'SUDAH_MENIKAH', 'CERAI_HIDUP', 'CERAI_MATI') NULL,
    `blood_type` ENUM('A', 'B', 'AB', 'O', 'TIDAK_TAHU') NULL,
    `address` TEXT NOT NULL,
    `address_ktp` TEXT NULL,
    `address_current` TEXT NULL,
    `address_same_as_ktp` BOOLEAN NOT NULL DEFAULT false,
    `province` VARCHAR(100) NULL,
    `city` VARCHAR(100) NULL,
    `whatsapp` VARCHAR(20) NOT NULL,
    `last_education` VARCHAR(100) NULL,
    `study_field` VARCHAR(150) NULL,
    `occupation` VARCHAR(150) NOT NULL,
    `expertise` TEXT NULL,
    `sermon_experience` ENUM('SERING', 'KADANG_KADANG', 'BELUM_PERNAH', 'LAINNYA') NOT NULL,
    `sermon_experience_other` VARCHAR(200) NULL,
    `organization_experience` TEXT NULL,
    `quran_reading` ENUM('TAJWID_BAIK', 'BIASA', 'TIDAK_LANCAR') NOT NULL,
    `training_reason` TEXT NOT NULL,
    `training_expectation` TEXT NOT NULL,
    `photo_path` VARCHAR(255) NULL,
    `ktp_path` VARCHAR(255) NULL,
    `password_hash` VARCHAR(255) NULL,
    `level_code` TINYINT NOT NULL DEFAULT 6,
    `province_code` CHAR(2) NULL,
    `regency_code` CHAR(2) NULL,
    `member_number` VARCHAR(20) NULL,
    `member_number_issued_at` DATETIME(3) NULL,
    `membership_status` ENUM('AKTIF', 'NONAKTIF', 'PURNABAKTI') NOT NULL DEFAULT 'AKTIF',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `uq_participants_nik`(`nik`),
    UNIQUE INDEX `uq_participants_member_number`(`member_number`),
    INDEX `idx_participants_created_at`(`created_at`),
    INDEX `idx_participants_origin`(`origin_type`, `origin_name`),
    INDEX `idx_participants_full_name`(`full_name`),
    INDEX `idx_participants_region`(`province_code`, `regency_code`),
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

-- CreateTable: master wilayah
CREATE TABLE `provinces` (
    `code` CHAR(2) NOT NULL,
    `name` VARCHAR(100) NOT NULL,

    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `regencies` (
    `province_code` CHAR(2) NOT NULL,
    `code` CHAR(2) NOT NULL,
    `name` VARCHAR(120) NOT NULL,

    PRIMARY KEY (`province_code`, `code`),
    INDEX `idx_regencies_province`(`province_code`),
    CONSTRAINT `regencies_province_code_fkey` FOREIGN KEY (`province_code`) REFERENCES `provinces` (`code`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: penghitung seri nomor anggota
CREATE TABLE `member_number_sequences` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `level_code` TINYINT NOT NULL,
    `province_code` CHAR(2) NOT NULL,
    `regency_code` CHAR(2) NOT NULL,
    `year` SMALLINT NOT NULL,
    `last_serial` SMALLINT UNSIGNED NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`),
    UNIQUE INDEX `uq_member_number_sequence`(`level_code`, `province_code`, `regency_code`, `year`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: riwayat cetak KTA (sekaligus kuota cetak global)
CREATE TABLE `kta_prints` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `participant_id` BIGINT UNSIGNED NOT NULL,
    `member_number` VARCHAR(20) NOT NULL,
    `printed_by_admin_id` BIGINT UNSIGNED NOT NULL,
    `printed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`),
    INDEX `idx_kta_prints_printed_at`(`printed_at`),
    INDEX `idx_kta_prints_participant`(`participant_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: nama pejabat penanda tangan KTA (diedit admin)
CREATE TABLE `kta_officials` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(20) NOT NULL,
    `nama` VARCHAR(200) NOT NULL,
    `jabatan` VARCHAR(120) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `kta_officials_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
