-- AlterTable
-- Down migration (forward-only in prod). Manual rollback:
-- ALTER TABLE `participants` DROP COLUMN `gender`, DROP COLUMN `photo_path`;
ALTER TABLE `participants`
    ADD COLUMN `gender` ENUM('LAKI_LAKI', 'PEREMPUAN') NULL AFTER `birth_date`,
    ADD COLUMN `photo_path` VARCHAR(255) NULL AFTER `training_expectation`;
