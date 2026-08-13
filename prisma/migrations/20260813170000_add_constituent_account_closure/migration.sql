-- Retain closed constituent history while removing the account from future CRM use.
ALTER TABLE `Constituent`
  ADD COLUMN `closedAt` DATETIME(3) NULL,
  ADD COLUMN `closedReason` TEXT NULL,
  ADD COLUMN `closedByUserId` VARCHAR(191) NULL;

CREATE INDEX `Constituent_organizationId_closedAt_idx`
  ON `Constituent`(`organizationId`, `closedAt`);
