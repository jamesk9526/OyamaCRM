-- Personal profile details used by self-service user settings.
ALTER TABLE `User`
  ADD COLUMN `preferredName` VARCHAR(191) NULL,
  ADD COLUMN `phone` VARCHAR(191) NULL,
  ADD COLUMN `jobTitle` VARCHAR(191) NULL,
  ADD COLUMN `timezone` VARCHAR(191) NULL DEFAULT 'America/Chicago',
  ADD COLUMN `bio` TEXT NULL;
