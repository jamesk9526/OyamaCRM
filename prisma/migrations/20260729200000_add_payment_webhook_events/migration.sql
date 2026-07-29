CREATE TABLE `PaymentWebhookEvent` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(32) NOT NULL,
    `externalEventId` VARCHAR(255) NOT NULL,
    `eventType` VARCHAR(120) NOT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'PROCESSING',
    `donationId` VARCHAR(191) NULL,
    `payloadHash` VARCHAR(64) NOT NULL,
    `errorMessage` TEXT NULL,
    `processedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PaymentWebhookEvent_provider_externalEventId_key`(`provider`, `externalEventId`),
    INDEX `PaymentWebhookEvent_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
    INDEX `PaymentWebhookEvent_donationId_idx`(`donationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PaymentWebhookEvent`
    ADD CONSTRAINT `PaymentWebhookEvent_organizationId_fkey`
    FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
