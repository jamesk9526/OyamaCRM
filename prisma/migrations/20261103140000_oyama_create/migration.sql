-- AlterTable
ALTER TABLE `OrganizationSettings` ADD COLUMN `oyamaCreateEnabled` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `CreateCampaign` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `objective` VARCHAR(191) NOT NULL DEFAULT 'GENERAL',
    `description` TEXT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `isTemplate` BOOLEAN NOT NULL DEFAULT false,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `revision` INTEGER NOT NULL DEFAULT 1,
    `fundraisingCampaignId` VARCHAR(191) NULL,
    `eventId` VARCHAR(191) NULL,
    `audienceListIds` JSON NOT NULL,
    `channelsJson` JSON NOT NULL,
    `deliveryMode` VARCHAR(191) NULL,
    `startsAt` DATETIME(3) NULL,
    `endsAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CreateCampaign_organizationId_isTemplate_updatedAt_idx`(`organizationId`, `isTemplate`, `updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreateContent` (
    `id` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `revision` INTEGER NOT NULL DEFAULT 1,
    `documentJson` JSON NOT NULL,
    `scheduledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CreateContent_organizationId_campaignId_idx`(`organizationId`, `campaignId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreateDocumentRevision` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `contentId` VARCHAR(191) NOT NULL,
    `revision` INTEGER NOT NULL,
    `documentJson` JSON NOT NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CreateDocumentRevision_contentId_revision_key`(`contentId`, `revision`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreateVariant` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `contentId` VARCHAR(191) NOT NULL,
    `channel` VARCHAR(191) NOT NULL,
    `revision` INTEGER NOT NULL DEFAULT 1,
    `documentJson` JSON NOT NULL,
    `needsReview` BOOLEAN NOT NULL DEFAULT false,
    `legacyId` VARCHAR(191) NULL,
    `legacyFingerprint` VARCHAR(191) NULL,
    `nativeApproved` BOOLEAN NOT NULL DEFAULT false,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CreateVariant_contentId_channel_key`(`contentId`, `channel`),
    UNIQUE INDEX `CreateVariant_organizationId_channel_legacyId_key`(`organizationId`, `channel`, `legacyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreateRelease` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NOT NULL,
    `campaignRevision` INTEGER NOT NULL,
    `fingerprint` VARCHAR(191) NOT NULL,
    `snapshotJson` JSON NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'APPROVED',
    `approvedBy` VARCHAR(191) NOT NULL,
    `approvedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CreateRelease_organizationId_approvedAt_idx`(`organizationId`, `approvedAt`),
    UNIQUE INDEX `CreateRelease_organizationId_campaignId_fingerprint_key`(`organizationId`, `campaignId`, `fingerprint`),
    UNIQUE INDEX `CreateRelease_campaignId_campaignRevision_key`(`campaignId`, `campaignRevision`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreateDelivery` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `releaseId` VARCHAR(191) NOT NULL,
    `contentId` VARCHAR(191) NOT NULL,
    `channel` VARCHAR(191) NOT NULL,
    `recipientKey` VARCHAR(191) NOT NULL,
    `deliveryKey` VARCHAR(191) NOT NULL,
    `payloadJson` JSON NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'HELD',
    `scheduledAt` DATETIME(3) NOT NULL,
    `claimedAt` DATETIME(3) NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `providerId` VARCHAR(191) NULL,
    `executionId` VARCHAR(191) NULL,
    `error` TEXT NULL,
    `acceptedAt` DATETIME(3) NULL,
    `deliveredAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CreateDelivery_deliveryKey_key`(`deliveryKey`),
    INDEX `CreateDelivery_organizationId_status_scheduledAt_idx`(`organizationId`, `status`, `scheduledAt`),
    INDEX `CreateDelivery_status_scheduledAt_idx`(`status`, `scheduledAt`),
    INDEX `CreateDelivery_organizationId_providerId_idx`(`organizationId`, `providerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreateConnection` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `configJson` JSON NOT NULL,
    `secret` TEXT NOT NULL,
    `webhookSecret` TEXT NOT NULL,
    `readyAt` DATETIME(3) NULL,
    `error` TEXT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CreateConnection_organizationId_provider_key`(`organizationId`, `provider`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreateSmsConsent` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `evidence` TEXT NOT NULL,
    `occurredAt` DATETIME(3) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CreateSmsConsent_organizationId_phone_key`(`organizationId`, `phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreateWebhookEvent` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `eventKey` VARCHAR(191) NOT NULL,
    `processedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CreateWebhookEvent_organizationId_provider_eventKey_key`(`organizationId`, `provider`, `eventKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreatePublication` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `contentId` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `documentJson` JSON NOT NULL,
    `variantJson` JSON NOT NULL,
    `webmasterSiteId` VARCHAR(191) NOT NULL,
    `webmasterVersionId` VARCHAR(191) NOT NULL,
    `publishedBy` VARCHAR(191) NOT NULL,
    `publishedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `active` BOOLEAN NOT NULL DEFAULT true,

    INDEX `CreatePublication_organizationId_contentId_publishedAt_idx`(`organizationId`, `contentId`, `publishedAt`),
    INDEX `CreatePublication_slug_active_idx`(`slug`, `active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreateLead` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NOT NULL,
    `publicationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `message` TEXT NULL,
    `consent` BOOLEAN NOT NULL,
    `consentText` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `matchedConstituentId` VARCHAR(191) NULL,
    `reviewedBy` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CreateLead_organizationId_status_createdAt_idx`(`organizationId`, `status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CreateContent` ADD CONSTRAINT `CreateContent_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `CreateCampaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreateDocumentRevision` ADD CONSTRAINT `CreateDocumentRevision_contentId_fkey` FOREIGN KEY (`contentId`) REFERENCES `CreateContent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreateVariant` ADD CONSTRAINT `CreateVariant_contentId_fkey` FOREIGN KEY (`contentId`) REFERENCES `CreateContent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreateRelease` ADD CONSTRAINT `CreateRelease_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `CreateCampaign`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreateDelivery` ADD CONSTRAINT `CreateDelivery_releaseId_fkey` FOREIGN KEY (`releaseId`) REFERENCES `CreateRelease`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreateLead` ADD CONSTRAINT `CreateLead_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `CreateCampaign`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

