-- AlterTable
ALTER TABLE `emailcampaign` ADD COLUMN `purpose` ENUM('MARKETING', 'FUNDRAISING', 'NEWSLETTER', 'EVENT_PROMOTION', 'RECEIPT', 'THANK_YOU', 'TRANSACTIONAL', 'ADMINISTRATIVE', 'PERSONAL') NOT NULL DEFAULT 'MARKETING';

-- CreateTable
CREATE TABLE `EmailSubscription` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `constituentId` VARCHAR(191) NULL,
    `email` VARCHAR(191) NOT NULL,
    `globalStatus` ENUM('SUBSCRIBED', 'UNSUBSCRIBED', 'PARTIALLY_SUBSCRIBED', 'BOUNCED', 'SUPPRESSED', 'PENDING_CONFIRMATION', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
    `source` VARCHAR(191) NULL,
    `subscribedAt` DATETIME(3) NULL,
    `unsubscribedAt` DATETIME(3) NULL,
    `confirmedAt` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EmailSubscription_organizationId_globalStatus_idx`(`organizationId`, `globalStatus`),
    INDEX `EmailSubscription_constituentId_idx`(`constituentId`),
    UNIQUE INDEX `es_org_email_uk`(`organizationId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailPreference` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `subscriptionId` VARCHAR(191) NOT NULL,
    `category` ENUM('NEWSLETTER', 'FUNDRAISING_APPEAL', 'EVENT_INVITATION', 'VOLUNTEER_UPDATES', 'PRAYER_MINISTRY_UPDATES', 'RECEIPTS', 'THANK_YOU_EMAILS', 'GRANT_SPONSOR_COMMUNICATION', 'ADMINISTRATIVE_NOTICE', 'PERSONAL_STAFF_EMAIL') NOT NULL,
    `status` ENUM('SUBSCRIBED', 'UNSUBSCRIBED') NOT NULL DEFAULT 'SUBSCRIBED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EmailPreference_organizationId_category_status_idx`(`organizationId`, `category`, `status`),
    UNIQUE INDEX `ep_subscription_category_uk`(`subscriptionId`, `category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailSuppression` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `constituentId` VARCHAR(191) NULL,
    `email` VARCHAR(191) NOT NULL,
    `reason` ENUM('UNSUBSCRIBED', 'DO_NOT_CONTACT', 'HARD_BOUNCE', 'SPAM_COMPLAINT', 'INVALID_EMAIL', 'MANUAL_SUPPRESSION', 'DECEASED', 'DUPLICATE_SUPPRESSED', 'IMPORTED_OPT_OUT', 'LEGAL_PRIVACY_REQUEST') NOT NULL,
    `source` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EmailSuppression_organizationId_email_active_idx`(`organizationId`, `email`, `active`),
    INDEX `EmailSuppression_organizationId_reason_active_idx`(`organizationId`, `reason`, `active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailConsentEvent` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `constituentId` VARCHAR(191) NULL,
    `subscriptionId` VARCHAR(191) NULL,
    `email` VARCHAR(191) NOT NULL,
    `eventType` ENUM('OPT_IN', 'OPT_OUT', 'PREFERENCE_UPDATED', 'SUPPRESSED', 'RESUBSCRIBED', 'DOUBLE_OPT_IN_CONFIRMED') NOT NULL,
    `category` ENUM('NEWSLETTER', 'FUNDRAISING_APPEAL', 'EVENT_INVITATION', 'VOLUNTEER_UPDATES', 'PRAYER_MINISTRY_UPDATES', 'RECEIPTS', 'THANK_YOU_EMAILS', 'GRANT_SPONSOR_COMMUNICATION', 'ADMINISTRATIVE_NOTICE', 'PERSONAL_STAFF_EMAIL') NULL,
    `source` VARCHAR(191) NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `consentText` TEXT NULL,
    `createdById` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EmailConsentEvent_organizationId_email_createdAt_idx`(`organizationId`, `email`, `createdAt`),
    INDEX `EmailConsentEvent_organizationId_eventType_category_idx`(`organizationId`, `eventType`, `category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailUnsubscribeToken` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `subscriptionId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `category` ENUM('NEWSLETTER', 'FUNDRAISING_APPEAL', 'EVENT_INVITATION', 'VOLUNTEER_UPDATES', 'PRAYER_MINISTRY_UPDATES', 'RECEIPTS', 'THANK_YOU_EMAILS', 'GRANT_SPONSOR_COMMUNICATION', 'ADMINISTRATIVE_NOTICE', 'PERSONAL_STAFF_EMAIL') NULL,
    `campaignId` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `EmailUnsubscribeToken_tokenHash_key`(`tokenHash`),
    INDEX `EmailUnsubscribeToken_organizationId_email_idx`(`organizationId`, `email`),
    INDEX `EmailUnsubscribeToken_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailSendRecipient` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NOT NULL,
    `subscriptionId` VARCHAR(191) NULL,
    `constituentId` VARCHAR(191) NULL,
    `email` VARCHAR(191) NOT NULL,
    `category` ENUM('NEWSLETTER', 'FUNDRAISING_APPEAL', 'EVENT_INVITATION', 'VOLUNTEER_UPDATES', 'PRAYER_MINISTRY_UPDATES', 'RECEIPTS', 'THANK_YOU_EMAILS', 'GRANT_SPONSOR_COMMUNICATION', 'ADMINISTRATIVE_NOTICE', 'PERSONAL_STAFF_EMAIL') NULL,
    `purpose` ENUM('MARKETING', 'FUNDRAISING', 'NEWSLETTER', 'EVENT_PROMOTION', 'RECEIPT', 'THANK_YOU', 'TRANSACTIONAL', 'ADMINISTRATIVE', 'PERSONAL') NOT NULL,
    `eligibilityStatus` ENUM('ELIGIBLE', 'SKIPPED_UNSUBSCRIBED', 'SKIPPED_CATEGORY_OPT_OUT', 'SKIPPED_SUPPRESSED', 'SKIPPED_DO_NOT_CONTACT', 'SKIPPED_HARD_BOUNCE', 'SKIPPED_MISSING_EMAIL', 'SKIPPED_INVALID_EMAIL', 'SKIPPED_DUPLICATE_EMAIL') NOT NULL DEFAULT 'ELIGIBLE',
    `ineligibilityReason` VARCHAR(191) NULL,
    `queuedAt` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EmailSendRecipient_organizationId_campaignId_eligibilityStat_idx`(`organizationId`, `campaignId`, `eligibilityStatus`),
    UNIQUE INDEX `esr_campaign_email_uk`(`campaignId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailDeliveryEvent` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `sendRecipientId` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NULL,
    `eventType` ENUM('DELIVERED', 'OPENED', 'CLICKED', 'BOUNCED', 'HARD_BOUNCED', 'SOFT_BOUNCED', 'SPAM_COMPLAINT', 'UNSUBSCRIBED', 'DROPPED', 'DEFERRED') NOT NULL,
    `eventAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EmailDeliveryEvent_sendRecipientId_eventType_eventAt_idx`(`sendRecipientId`, `eventType`, `eventAt`),
    INDEX `EmailDeliveryEvent_campaignId_eventType_eventAt_idx`(`campaignId`, `eventType`, `eventAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EmailSubscription` ADD CONSTRAINT `EmailSubscription_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailSubscription` ADD CONSTRAINT `EmailSubscription_constituentId_fkey` FOREIGN KEY (`constituentId`) REFERENCES `Constituent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailPreference` ADD CONSTRAINT `EmailPreference_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailPreference` ADD CONSTRAINT `EmailPreference_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `EmailSubscription`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailSuppression` ADD CONSTRAINT `EmailSuppression_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailSuppression` ADD CONSTRAINT `EmailSuppression_constituentId_fkey` FOREIGN KEY (`constituentId`) REFERENCES `Constituent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailConsentEvent` ADD CONSTRAINT `EmailConsentEvent_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailConsentEvent` ADD CONSTRAINT `EmailConsentEvent_constituentId_fkey` FOREIGN KEY (`constituentId`) REFERENCES `Constituent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailConsentEvent` ADD CONSTRAINT `EmailConsentEvent_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `EmailSubscription`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailUnsubscribeToken` ADD CONSTRAINT `EmailUnsubscribeToken_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailUnsubscribeToken` ADD CONSTRAINT `EmailUnsubscribeToken_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `EmailSubscription`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailUnsubscribeToken` ADD CONSTRAINT `EmailUnsubscribeToken_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `EmailCampaign`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailSendRecipient` ADD CONSTRAINT `EmailSendRecipient_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailSendRecipient` ADD CONSTRAINT `EmailSendRecipient_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `EmailCampaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailSendRecipient` ADD CONSTRAINT `EmailSendRecipient_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `EmailSubscription`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailSendRecipient` ADD CONSTRAINT `EmailSendRecipient_constituentId_fkey` FOREIGN KEY (`constituentId`) REFERENCES `Constituent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailDeliveryEvent` ADD CONSTRAINT `EmailDeliveryEvent_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailDeliveryEvent` ADD CONSTRAINT `EmailDeliveryEvent_sendRecipientId_fkey` FOREIGN KEY (`sendRecipientId`) REFERENCES `EmailSendRecipient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailDeliveryEvent` ADD CONSTRAINT `EmailDeliveryEvent_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `EmailCampaign`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
