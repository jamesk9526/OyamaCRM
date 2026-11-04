-- AlterTable
ALTER TABLE `CreateContent` ADD COLUMN `designJson` JSON NULL;

-- AlterTable
ALTER TABLE `OrganizationSettings` ADD COLUMN `createBrandPublicBaselineId` VARCHAR(191) NULL,
    ADD COLUMN `oyamaCreateBrandHubEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `oyamaCreateStudioEnabled` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `CreateBrandDraft` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `revision` INTEGER NOT NULL DEFAULT 1,
    `documentJson` JSON NOT NULL,
    `updatedBy` VARCHAR(191) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CreateBrandDraft_organizationId_key`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreateBrandRevision` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `revision` INTEGER NOT NULL,
    `documentJson` JSON NOT NULL,
    `publishedBy` VARCHAR(191) NOT NULL,
    `publishedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CreateBrandRevision_organizationId_publishedAt_idx`(`organizationId`, `publishedAt`),
    UNIQUE INDEX `CreateBrandRevision_organizationId_revision_key`(`organizationId`, `revision`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreateStudioAsset` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'IMAGE',
    `url` TEXT NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `bytes` INTEGER NOT NULL,
    `checksum` VARCHAR(191) NOT NULL,
    `uploadedBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CreateStudioAsset_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreateBrandBinding` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `channel` VARCHAR(191) NOT NULL,
    `resourceId` VARCHAR(191) NOT NULL,
    `brandRevisionId` VARCHAR(191) NOT NULL,
    `revision` INTEGER NOT NULL DEFAULT 1,
    `updatedBy` VARCHAR(191) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CreateBrandBinding_organizationId_channel_resourceId_key`(`organizationId`, `channel`, `resourceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreateStudioSection` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `documentJson` JSON NOT NULL,
    `shared` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CreateStudioSection_organizationId_updatedAt_idx`(`organizationId`, `updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreateResponseCode` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `lookupKey` VARCHAR(191) NOT NULL,
    `releaseId` VARCHAR(191) NOT NULL,
    `contentId` VARCHAR(191) NOT NULL,
    `constituentId` VARCHAR(191) NULL,
    `channel` VARCHAR(191) NOT NULL,
    `payloadJson` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CreateResponseCode_code_key`(`code`),
    UNIQUE INDEX `CreateResponseCode_lookupKey_key`(`lookupKey`),
    INDEX `CreateResponseCode_organizationId_releaseId_idx`(`organizationId`, `releaseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreatePrintArtifact` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `deliveryId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `generatedLetterId` VARCHAR(191) NULL,
    `renderJobId` VARCHAR(191) NULL,
    `snapshotJson` JSON NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'HELD',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CreatePrintArtifact_generatedLetterId_key`(`generatedLetterId`),
    INDEX `CreatePrintArtifact_organizationId_deliveryId_idx`(`organizationId`, `deliveryId`),
    UNIQUE INDEX `CreatePrintArtifact_deliveryId_kind_key`(`deliveryId`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
