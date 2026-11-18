-- Riwayat perubahan keanggotaan. Level & wilayah boleh diubah walau nomor
-- anggota sudah terbit, jadi setiap perubahan harus terekam.
-- Down: DROP TABLE `membership_histories`;
CREATE TABLE `membership_histories` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `participant_id` BIGINT UNSIGNED NOT NULL,
    `field` VARCHAR(20) NOT NULL,
    `old_value` VARCHAR(120) NULL,
    `new_value` VARCHAR(120) NULL,
    `actor_kind` VARCHAR(20) NOT NULL,
    `actor_id` VARCHAR(20) NULL,
    `changed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_membership_history_participant`(`participant_id`, `changed_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `membership_histories`
  ADD CONSTRAINT `membership_histories_participant_id_fkey`
  FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
