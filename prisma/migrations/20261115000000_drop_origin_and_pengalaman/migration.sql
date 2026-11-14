-- Drop kolom asal IKADI (PW/PD), kolom pengalaman, dan kolom motivasi peserta.
-- Data di kolom ini hilang permanen; sudah disetujui pemilik proyek.
ALTER TABLE `participants`
  DROP INDEX `idx_participants_origin`,
  DROP COLUMN `origin_type`,
  DROP COLUMN `origin_name`,
  DROP COLUMN `sermon_experience`,
  DROP COLUMN `sermon_experience_other`,
  DROP COLUMN `organization_experience`,
  DROP COLUMN `quran_reading`,
  DROP COLUMN `training_reason`,
  DROP COLUMN `training_expectation`;
