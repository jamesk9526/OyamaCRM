-- Add canonical identity fields for person and organization constituents.
ALTER TABLE `Constituent`
  ADD COLUMN `displayName` VARCHAR(191) NULL,
  ADD COLUMN `organizationName` VARCHAR(191) NULL,
  ADD COLUMN `contactFirstName` VARCHAR(191) NULL,
  ADD COLUMN `contactLastName` VARCHAR(191) NULL,
  ADD COLUMN `contactTitle` VARCHAR(191) NULL,
  ADD COLUMN `entityKind` VARCHAR(191) NOT NULL DEFAULT 'PERSON',
  ADD COLUMN `organizationCategory` VARCHAR(191) NULL;
