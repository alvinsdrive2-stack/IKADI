-- CreateTable: nama pejabat penanda tangan KTA (diedit admin lewat /admin/kta/pejabat)
-- Down: DROP TABLE `kta_officials`;
CREATE TABLE `kta_officials` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(20) NOT NULL,
    `nama` VARCHAR(200) NOT NULL,
    `jabatan` VARCHAR(120) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `kta_officials_key_key` (`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
