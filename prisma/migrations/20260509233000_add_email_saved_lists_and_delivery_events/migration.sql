-- AlterTable
ALTER TABLE `EmailCampaign`
    MODIFY `status` ENUM('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'CANCELLED') NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE `EmailRecipientList` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EmailRecipientList_organizationId_idx`(`organizationId`),
    INDEX `EmailRecipientList_organizationId_name_idx`(`organizationId`, `name`),
    INDEX `EmailRecipientList_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailRecipientListMember` (
    `id` VARCHAR(191) NOT NULL,
    `listId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NULL,
    `lastName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EmailRecipientListMember_listId_idx`(`listId`),
    UNIQUE INDEX `EmailRecipientListMember_listId_email_key`(`listId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailCampaignDeliveryEvent` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NOT NULL,
    `recipientEmail` VARCHAR(191) NOT NULL,
    `eventType` ENUM('QUEUED', 'DELIVERED', 'OPENED', 'CLICKED', 'BOUNCED') NOT NULL,
    `eventAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EmailCampaignDeliveryEvent_campaignId_eventType_eventAt_idx`(`campaignId`, `eventType`, `eventAt`),
    INDEX `EmailCampaignDeliveryEvent_campaignId_recipientEmail_idx`(`campaignId`, `recipientEmail`),
    UNIQUE INDEX `ecd_campaign_recipient_event_uk`(`campaignId`, `recipientEmail`, `eventType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EmailRecipientList` ADD CONSTRAINT `EmailRecipientList_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailRecipientList` ADD CONSTRAINT `EmailRecipientList_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailRecipientListMember` ADD CONSTRAINT `EmailRecipientListMember_listId_fkey` FOREIGN KEY (`listId`) REFERENCES `EmailRecipientList`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailCampaignDeliveryEvent` ADD CONSTRAINT `EmailCampaignDeliveryEvent_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailCampaignDeliveryEvent` ADD CONSTRAINT `EmailCampaignDeliveryEvent_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `EmailCampaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
