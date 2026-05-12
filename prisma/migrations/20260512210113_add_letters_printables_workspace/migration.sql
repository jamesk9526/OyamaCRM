-- CreateTable
CREATE TABLE `LetterHeaderPreset` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `logoAlignment` ENUM('LEFT', 'CENTER', 'RIGHT', 'NONE') NOT NULL DEFAULT 'LEFT',
    `showOrganizationName` BOOLEAN NOT NULL DEFAULT true,
    `showTagline` BOOLEAN NOT NULL DEFAULT false,
    `showAddress` BOOLEAN NOT NULL DEFAULT true,
    `showPhone` BOOLEAN NOT NULL DEFAULT true,
    `showWebsite` BOOLEAN NOT NULL DEFAULT true,
    `customHtml` LONGTEXT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LetterHeaderPreset_organizationId_isActive_idx`(`organizationId`, `isActive`),
    INDEX `LetterHeaderPreset_organizationId_isDefault_idx`(`organizationId`, `isDefault`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LetterFooterPreset` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `showOrganizationName` BOOLEAN NOT NULL DEFAULT true,
    `showAddress` BOOLEAN NOT NULL DEFAULT true,
    `showPhone` BOOLEAN NOT NULL DEFAULT true,
    `showEmail` BOOLEAN NOT NULL DEFAULT true,
    `showWebsite` BOOLEAN NOT NULL DEFAULT true,
    `showTaxId` BOOLEAN NOT NULL DEFAULT false,
    `showPageNumber` BOOLEAN NOT NULL DEFAULT false,
    `customText` TEXT NULL,
    `customHtml` LONGTEXT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LetterFooterPreset_organizationId_isActive_idx`(`organizationId`, `isActive`),
    INDEX `LetterFooterPreset_organizationId_isDefault_idx`(`organizationId`, `isDefault`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LetterSignatureBlock` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `signerName` VARCHAR(191) NOT NULL,
    `signerTitle` VARCHAR(191) NULL,
    `closingPhrase` VARCHAR(191) NULL,
    `signatureImageUrl` VARCHAR(191) NULL,
    `typedSignature` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LetterSignatureBlock_organizationId_isActive_idx`(`organizationId`, `isActive`),
    INDEX `LetterSignatureBlock_organizationId_isDefault_idx`(`organizationId`, `isDefault`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LetterTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` ENUM('THANK_YOU', 'TAX_RECEIPT', 'END_OF_YEAR', 'NEWSLETTER', 'CAMPAIGN', 'SPONSOR', 'EVENT', 'MONTHLY_DONOR', 'MAJOR_DONOR', 'GENERAL') NOT NULL DEFAULT 'GENERAL',
    `description` TEXT NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `printSubject` VARCHAR(191) NULL,
    `printBody` LONGTEXT NOT NULL,
    `emailSubject` VARCHAR(191) NULL,
    `emailBody` LONGTEXT NULL,
    `headerPresetId` VARCHAR(191) NULL,
    `footerPresetId` VARCHAR(191) NULL,
    `signatureBlockId` VARCHAR(191) NULL,
    `logoMode` ENUM('ORGANIZATION_DEFAULT', 'CUSTOM', 'NONE') NOT NULL DEFAULT 'ORGANIZATION_DEFAULT',
    `customLogoUrl` VARCHAR(191) NULL,
    `mergeFieldsUsed` JSON NULL,
    `crmScope` ENUM('DONOR', 'EVENTS', 'COMPASSION', 'GLOBAL') NOT NULL DEFAULT 'DONOR',
    `createdByUserId` VARCHAR(191) NOT NULL,
    `updatedByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LetterTemplate_organizationId_status_idx`(`organizationId`, `status`),
    INDEX `LetterTemplate_organizationId_category_idx`(`organizationId`, `category`),
    INDEX `LetterTemplate_organizationId_updatedAt_idx`(`organizationId`, `updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GeneratedLetter` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `constituentId` VARCHAR(191) NULL,
    `donationId` VARCHAR(191) NULL,
    `campaignId` VARCHAR(191) NULL,
    `eventId` VARCHAR(191) NULL,
    `category` ENUM('THANK_YOU', 'TAX_RECEIPT', 'END_OF_YEAR', 'NEWSLETTER', 'CAMPAIGN', 'SPONSOR', 'EVENT', 'MONTHLY_DONOR', 'MAJOR_DONOR', 'GENERAL') NOT NULL,
    `status` ENUM('DRAFT', 'GENERATED', 'PRINTED', 'MAILED', 'EMAIL_DRAFT_CREATED', 'EMAIL_SENT', 'ARCHIVED') NOT NULL DEFAULT 'GENERATED',
    `mergedPrintSubject` VARCHAR(191) NULL,
    `mergedPrintBody` LONGTEXT NOT NULL,
    `mergedEmailBody` LONGTEXT NULL,
    `emailSubject` VARCHAR(191) NULL,
    `pdfUrl` VARCHAR(191) NULL,
    `emailCampaignId` VARCHAR(191) NULL,
    `communicationActivityId` VARCHAR(191) NULL,
    `generatedByUserId` VARCHAR(191) NOT NULL,
    `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `printedAt` DATETIME(3) NULL,
    `mailedAt` DATETIME(3) NULL,
    `emailDraftCreatedAt` DATETIME(3) NULL,
    `emailSentAt` DATETIME(3) NULL,
    `metadataJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `GeneratedLetter_organizationId_status_idx`(`organizationId`, `status`),
    INDEX `GeneratedLetter_organizationId_category_idx`(`organizationId`, `category`),
    INDEX `GeneratedLetter_constituentId_generatedAt_idx`(`constituentId`, `generatedAt`),
    INDEX `GeneratedLetter_templateId_generatedAt_idx`(`templateId`, `generatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `LetterHeaderPreset` ADD CONSTRAINT `LetterHeaderPreset_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LetterFooterPreset` ADD CONSTRAINT `LetterFooterPreset_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LetterSignatureBlock` ADD CONSTRAINT `LetterSignatureBlock_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LetterTemplate` ADD CONSTRAINT `LetterTemplate_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LetterTemplate` ADD CONSTRAINT `LetterTemplate_headerPresetId_fkey` FOREIGN KEY (`headerPresetId`) REFERENCES `LetterHeaderPreset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LetterTemplate` ADD CONSTRAINT `LetterTemplate_footerPresetId_fkey` FOREIGN KEY (`footerPresetId`) REFERENCES `LetterFooterPreset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LetterTemplate` ADD CONSTRAINT `LetterTemplate_signatureBlockId_fkey` FOREIGN KEY (`signatureBlockId`) REFERENCES `LetterSignatureBlock`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LetterTemplate` ADD CONSTRAINT `LetterTemplate_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LetterTemplate` ADD CONSTRAINT `LetterTemplate_updatedByUserId_fkey` FOREIGN KEY (`updatedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GeneratedLetter` ADD CONSTRAINT `GeneratedLetter_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GeneratedLetter` ADD CONSTRAINT `GeneratedLetter_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `LetterTemplate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GeneratedLetter` ADD CONSTRAINT `GeneratedLetter_constituentId_fkey` FOREIGN KEY (`constituentId`) REFERENCES `Constituent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GeneratedLetter` ADD CONSTRAINT `GeneratedLetter_donationId_fkey` FOREIGN KEY (`donationId`) REFERENCES `Donation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GeneratedLetter` ADD CONSTRAINT `GeneratedLetter_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GeneratedLetter` ADD CONSTRAINT `GeneratedLetter_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GeneratedLetter` ADD CONSTRAINT `GeneratedLetter_emailCampaignId_fkey` FOREIGN KEY (`emailCampaignId`) REFERENCES `EmailCampaign`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GeneratedLetter` ADD CONSTRAINT `GeneratedLetter_generatedByUserId_fkey` FOREIGN KEY (`generatedByUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
