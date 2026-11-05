-- Additive; existing communications and frozen artifacts are not rewritten.
CREATE TABLE `CreateImportRun` (
 `id` VARCHAR(191) NOT NULL, `organizationId` VARCHAR(191) NOT NULL, `actorId` VARCHAR(191) NOT NULL,
 `status` VARCHAR(191) NOT NULL DEFAULT 'RUNNING', `cursorJson` JSON NOT NULL, `inventoryJson` JSON NULL, `scanned` INTEGER NOT NULL DEFAULT 0,
 `leaseToken` VARCHAR(191) NULL, `leaseUntil` DATETIME(3) NULL, `nextScanAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 `lastError` TEXT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
 PRIMARY KEY (`id`), UNIQUE INDEX `CreateImportRun_organizationId_key` (`organizationId`), INDEX `CreateImportRun_status_nextScanAt_idx` (`status`,`nextScanAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `CreateImportSource` (
 `id` VARCHAR(191) NOT NULL, `organizationId` VARCHAR(191) NOT NULL, `sourceType` VARCHAR(191) NOT NULL,
 `sourceId` VARCHAR(191) NOT NULL, `name` VARCHAR(191) NOT NULL, `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
 `fingerprint` VARCHAR(191) NULL, `acceptedFingerprint` VARCHAR(191) NULL, `campaignId` VARCHAR(191) NULL,
 `contentId` VARCHAR(191) NULL, `ownerId` VARCHAR(191) NULL, `shared` BOOLEAN NOT NULL DEFAULT false,
 `missing` BOOLEAN NOT NULL DEFAULT false, `diagnostics` JSON NOT NULL, `error` TEXT NULL,
 `sourceUpdatedAt` DATETIME(3) NULL, `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
 PRIMARY KEY (`id`), UNIQUE INDEX `CreateImportSource_organizationId_sourceType_sourceId_key` (`organizationId`,`sourceType`,`sourceId`),
 INDEX `CreateImportSource_organizationId_status_updatedAt_idx` (`organizationId`,`status`,`updatedAt`),
 INDEX `CreateImportSource_organizationId_contentId_idx` (`organizationId`,`contentId`),
 INDEX `CreateImportSource_organizationId_campaignId_idx` (`organizationId`,`campaignId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `CreateImportSourceRevision` (
 `id` VARCHAR(191) NOT NULL, `sourceId` VARCHAR(191) NOT NULL, `fingerprint` VARCHAR(191) NOT NULL, `snapshotJson` JSON NOT NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`),
 UNIQUE INDEX `CreateImportSourceRevision_sourceId_fingerprint_key` (`sourceId`,`fingerprint`),
 CONSTRAINT `CreateImportSourceRevision_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `CreateImportSource` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
