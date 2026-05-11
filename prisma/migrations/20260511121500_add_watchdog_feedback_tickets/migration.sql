-- CreateTable
CREATE TABLE `WatchdogFeedbackTicket` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `ticketNumber` VARCHAR(191) NOT NULL,
    `type` VARCHAR(40) NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'new',
    `priority` VARCHAR(20) NOT NULL DEFAULT 'normal',
    `crmScope` VARCHAR(20) NOT NULL DEFAULT 'unknown',
    `pageUrl` VARCHAR(191) NOT NULL,
    `routePath` VARCHAR(191) NULL,
    `pageTitle` VARCHAR(191) NULL,
    `submittedByUserId` VARCHAR(191) NULL,
    `submittedByName` VARCHAR(191) NULL,
    `submittedByEmail` VARCHAR(191) NULL,
    `whatTryingToDo` TEXT NULL,
    `whatHappened` TEXT NULL,
    `expectedResult` TEXT NULL,
    `extraComments` TEXT NULL,
    `featureTitle` VARCHAR(191) NULL,
    `featureProblem` TEXT NULL,
    `featureAudience` VARCHAR(191) NULL,
    `featureRequestedChange` TEXT NULL,
    `importance` VARCHAR(20) NULL,
    `browserInfo` VARCHAR(191) NULL,
    `deviceInfo` VARCHAR(191) NULL,
    `appVersion` VARCHAR(191) NULL,
    `environment` VARCHAR(20) NULL,
    `assignedDeveloperId` VARCHAR(191) NULL,
    `assignedToPersonId` VARCHAR(191) NULL,
    `developerNotes` TEXT NULL,
    `resolutionNotes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `resolvedAt` DATETIME(3) NULL,

    UNIQUE INDEX `WatchdogFeedbackTicket_ticketNumber_key`(`ticketNumber`),
    INDEX `WatchdogFeedbackTicket_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
    INDEX `WatchdogFeedbackTicket_organizationId_status_idx`(`organizationId`, `status`),
    INDEX `WatchdogFeedbackTicket_organizationId_type_idx`(`organizationId`, `type`),
    INDEX `WatchdogFeedbackTicket_organizationId_priority_idx`(`organizationId`, `priority`),
    INDEX `WatchdogFeedbackTicket_organizationId_crmScope_idx`(`organizationId`, `crmScope`),
    INDEX `WatchdogFeedbackTicket_organizationId_submittedByUserId_idx`(`organizationId`, `submittedByUserId`),
    INDEX `WatchdogFeedbackTicket_organizationId_assignedDeveloperId_idx`(`organizationId`, `assignedDeveloperId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `WatchdogFeedbackTicket` ADD CONSTRAINT `WatchdogFeedbackTicket_submittedByUserId_fkey` FOREIGN KEY (`submittedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WatchdogFeedbackTicket` ADD CONSTRAINT `WatchdogFeedbackTicket_assignedDeveloperId_fkey` FOREIGN KEY (`assignedDeveloperId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
