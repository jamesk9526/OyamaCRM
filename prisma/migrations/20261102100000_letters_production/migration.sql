-- AlterTable
ALTER TABLE `LetterTemplate` ADD COLUMN `documentJson` JSON NULL,
    ADD COLUMN `documentSchemaVersion` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `revision` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `GeneratedLetter` ADD COLUMN `productionKey` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `LetterDocumentRevision` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `revision` INTEGER NOT NULL,
    `snapshotJson` JSON NOT NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `LetterDocumentRevision_organizationId_templateId_revision_key`(`organizationId`, `templateId`, `revision`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LetterRenderJob` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `generatedLetterId` VARCHAR(191) NULL,
    `fingerprint` VARCHAR(191) NOT NULL,
    `rendererVersion` VARCHAR(191) NOT NULL,
    `snapshotJson` JSON NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `leaseToken` VARCHAR(191) NULL,
    `leaseUntil` DATETIME(3) NULL,
    `error` TEXT NULL,
    `checksum` VARCHAR(191) NULL,
    `pageCount` INTEGER NULL,
    `warningsJson` JSON NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LetterRenderJob_status_leaseUntil_createdAt_idx`(`status`, `leaseUntil`, `createdAt`),
    INDEX `LetterRenderJob_organizationId_generatedLetterId_idx`(`organizationId`, `generatedLetterId`),
    UNIQUE INDEX `LetterRenderJob_organizationId_fingerprint_key`(`organizationId`, `fingerprint`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LetterArtifactApproval` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `artifactId` VARCHAR(191) NOT NULL,
    `checksum` VARCHAR(191) NOT NULL,
    `approvedBy` VARCHAR(191) NOT NULL,
    `approvedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `LetterArtifactApproval_organizationId_artifactId_checksum_key`(`organizationId`, `artifactId`, `checksum`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LetterProductionBatch` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `manifestKey` VARCHAR(191) NOT NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LetterProductionBatch_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
    UNIQUE INDEX `LetterProductionBatch_organizationId_manifestKey_key`(`organizationId`, `manifestKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LetterProductionBatchItem` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `batchId` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL,
    `generatedLetterId` VARCHAR(191) NOT NULL,
    `artifactId` VARCHAR(191) NOT NULL,

    INDEX `LetterProductionBatchItem_organizationId_batchId_idx`(`organizationId`, `batchId`),
    UNIQUE INDEX `LetterProductionBatchItem_batchId_position_key`(`batchId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LetterProductionEvent` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `artifactId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `reason` TEXT NULL,
    `actorId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LetterProductionEvent_organizationId_artifactId_createdAt_idx`(`organizationId`, `artifactId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `GeneratedLetter_productionKey_key` ON `GeneratedLetter`(`productionKey`);
