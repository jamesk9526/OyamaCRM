CREATE TABLE `DonorResearchFinding` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `constituentId` VARCHAR(191) NOT NULL,
  `provider` VARCHAR(40) NOT NULL,
  `sourceRecordId` VARCHAR(120) NULL,
  `sourceUrl` VARCHAR(1000) NOT NULL,
  `signalType` VARCHAR(60) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `summary` TEXT NOT NULL,
  `disclosedAmount` DECIMAL(16, 2) NULL,
  `disclosedAmountLabel` VARCHAR(120) NULL,
  `sourcePublishedAt` DATETIME(3) NULL,
  `matchConfidence` VARCHAR(20) NOT NULL DEFAULT 'LOW',
  `matchRationale` TEXT NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'UNVERIFIED',
  `reviewNotes` TEXT NULL,
  `createdByUserId` VARCHAR(191) NOT NULL,
  `reviewedByUserId` VARCHAR(191) NULL,
  `reviewedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `DonorResearchFinding_organizationId_status_idx`(`organizationId`, `status`),
  INDEX `DonorResearchFinding_constituentId_createdAt_idx`(`constituentId`, `createdAt`),
  INDEX `DonorResearchFinding_provider_sourceRecordId_idx`(`provider`, `sourceRecordId`),
  INDEX `DonorResearchFinding_createdByUserId_idx`(`createdByUserId`),
  INDEX `DonorResearchFinding_reviewedByUserId_idx`(`reviewedByUserId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DonorResearchFinding`
  ADD CONSTRAINT `DonorResearchFinding_organizationId_fkey`
  FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `DonorResearchFinding`
  ADD CONSTRAINT `DonorResearchFinding_constituentId_fkey`
  FOREIGN KEY (`constituentId`) REFERENCES `Constituent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `DonorResearchFinding`
  ADD CONSTRAINT `DonorResearchFinding_createdByUserId_fkey`
  FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `DonorResearchFinding`
  ADD CONSTRAINT `DonorResearchFinding_reviewedByUserId_fkey`
  FOREIGN KEY (`reviewedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
