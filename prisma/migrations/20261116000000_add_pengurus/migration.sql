-- Peran pengurus terpisah dari level kepengurusan.
-- is_pengurus = 1 memberi akses menu pengurus; level 1..3 menentukan jenisnya.
ALTER TABLE `participants`
  ADD COLUMN `is_pengurus` BOOLEAN NOT NULL DEFAULT false,
  ADD INDEX `idx_participants_pengurus` (`is_pengurus`, `level_code`);

-- Pengurus mencetak KTA tanpa akun admin, jadi pencetak bisa admin ATAU peserta.
ALTER TABLE `kta_prints`
  MODIFY `printed_by_admin_id` BIGINT UNSIGNED NULL,
  ADD COLUMN `printed_by_participant_id` BIGINT UNSIGNED NULL;
