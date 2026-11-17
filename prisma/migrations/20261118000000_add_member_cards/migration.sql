-- Riwayat kartu anggota: satu peserta boleh punya banyak nomor, satu aktif.
-- `participants.member_number` tetap jadi cermin kartu aktif (ditulis aplikasi).
-- Down: DROP TABLE `member_cards`;
CREATE TABLE `member_cards` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `participant_id` BIGINT UNSIGNED NOT NULL,
    `member_number` VARCHAR(20) NOT NULL,
    `level_code` TINYINT NOT NULL,
    `province_code` CHAR(2) NOT NULL,
    `regency_code` CHAR(2) NOT NULL,
    `issued_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `is_manual` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT false,
    `retired_at` DATETIME(3) NULL,

    UNIQUE INDEX `uq_member_cards_number`(`member_number`),
    INDEX `idx_member_cards_participant`(`participant_id`, `is_active`),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `member_cards`
  ADD CONSTRAINT `member_cards_participant_id_fkey`
  FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
