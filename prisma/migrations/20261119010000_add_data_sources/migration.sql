-- Sumber data peserta. Tabel terpisah supaya peserta hanya menyimpan id sumber.
-- Down: ALTER TABLE `participants` DROP FOREIGN KEY `participants_source_id_fkey`,
--   DROP INDEX `idx_participants_source`, DROP COLUMN `source_id`;
--   DROP TABLE `data_sources`;
CREATE TABLE `data_sources` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(50) NOT NULL,
    `label` VARCHAR(120) NOT NULL,
    `origin` VARCHAR(120) NULL,
    `imported_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `note` TEXT NULL,

    UNIQUE INDEX `data_sources_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `participants`
  ADD COLUMN `source_id` INT NULL,
  ADD INDEX `idx_participants_source`(`source_id`),
  ADD CONSTRAINT `participants_source_id_fkey`
    FOREIGN KEY (`source_id`) REFERENCES `data_sources`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
