-- CreateTable
CREATE TABLE `Survey` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `audience` ENUM('DONOR', 'CLIENT') NOT NULL,
    `identity` ENUM('LINKED', 'ANONYMOUS') NOT NULL,
    `status` ENUM('DRAFT', 'LIVE', 'CLOSED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `draft` JSON NOT NULL,
    `editVersion` INTEGER NOT NULL DEFAULT 1,
    `published` INTEGER NOT NULL DEFAULT 0,
    `closesAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Survey_organizationId_audience_updatedAt_idx`(`organizationId`, `audience`, `updatedAt`),
    UNIQUE INDEX `Survey_organizationId_id_key`(`organizationId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SurveyRevision` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `surveyId` VARCHAR(191) NOT NULL,
    `number` INTEGER NOT NULL,
    `definition` JSON NOT NULL,
    `publicKey` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SurveyRevision_publicKey_key`(`publicKey`),
    UNIQUE INDEX `SurveyRevision_organizationId_id_key`(`organizationId`, `id`),
    UNIQUE INDEX `SurveyRevision_organizationId_surveyId_number_key`(`organizationId`, `surveyId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SurveyTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `audience` ENUM('DONOR', 'CLIENT') NOT NULL,
    `definition` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SurveyTemplate_organizationId_audience_createdAt_idx`(`organizationId`, `audience`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SurveyDistribution` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `revisionId` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NOT NULL,
    `requestKey` VARCHAR(64) NOT NULL,
    `requestHash` VARCHAR(64) NOT NULL,
    `reviewHash` VARCHAR(64) NOT NULL,
    `message` TEXT NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `sender` VARCHAR(320) NOT NULL,
    `origin` VARCHAR(320) NOT NULL,
    `sendAt` DATETIME(3) NOT NULL,
    `reminderDays` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SurveyDistribution_organizationId_revisionId_createdAt_idx`(`organizationId`, `revisionId`, `createdAt`),
    UNIQUE INDEX `SurveyDistribution_organizationId_id_key`(`organizationId`, `id`),
    UNIQUE INDEX `SurveyDistribution_organizationId_requestKey_key`(`organizationId`, `requestKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SurveyInvitation` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `revisionId` VARCHAR(191) NOT NULL,
    `distributionId` VARCHAR(191) NULL,
    `contactId` VARCHAR(191) NOT NULL,
    `addressHash` VARCHAR(64) NULL,
    `tokenHash` VARCHAR(64) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SurveyInvitation_tokenHash_key`(`tokenHash`),
    INDEX `SurveyInvitation_organizationId_distributionId_idx`(`organizationId`, `distributionId`),
    UNIQUE INDEX `SurveyInvitation_organizationId_id_key`(`organizationId`, `id`),
    UNIQUE INDEX `SurveyInvitation_organizationId_revisionId_contactId_key`(`organizationId`, `revisionId`, `contactId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SurveyResponse` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `revisionId` VARCHAR(191) NOT NULL,
    `invitationId` VARCHAR(191) NULL,
    `donorId` VARCHAR(191) NULL,
    `clientId` VARCHAR(191) NULL,
    `submissionKey` VARCHAR(64) NOT NULL,
    `payload` LONGTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SurveyResponse_organizationId_revisionId_createdAt_idx`(`organizationId`, `revisionId`, `createdAt`),
    INDEX `SurveyResponse_organizationId_donorId_idx`(`organizationId`, `donorId`),
    INDEX `SurveyResponse_organizationId_clientId_idx`(`organizationId`, `clientId`),
    UNIQUE INDEX `SurveyResponse_organizationId_revisionId_submissionKey_key`(`organizationId`, `revisionId`, `submissionKey`),
    UNIQUE INDEX `SurveyResponse_organizationId_invitationId_key`(`organizationId`, `invitationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SurveyDeliveryJob` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `invitationId` VARCHAR(191) NOT NULL,
    `reminder` BOOLEAN NOT NULL,
    `dueAt` DATETIME(3) NOT NULL,
    `status` ENUM('QUEUED', 'SENDING', 'SENT', 'FAILED', 'UNKNOWN', 'SKIPPED') NOT NULL DEFAULT 'QUEUED',
    `claimedAt` DATETIME(3) NULL,
    `finishedAt` DATETIME(3) NULL,
    `outcome` VARCHAR(191) NULL,

    INDEX `SurveyDeliveryJob_status_dueAt_idx`(`status`, `dueAt`),
    UNIQUE INDEX `SurveyDeliveryJob_organizationId_invitationId_reminder_key`(`organizationId`, `invitationId`, `reminder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SurveyRevision` ADD CONSTRAINT `SurveyRevision_organizationId_surveyId_fkey` FOREIGN KEY (`organizationId`, `surveyId`) REFERENCES `Survey`(`organizationId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SurveyDistribution` ADD CONSTRAINT `SurveyDistribution_organizationId_revisionId_fkey` FOREIGN KEY (`organizationId`, `revisionId`) REFERENCES `SurveyRevision`(`organizationId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SurveyInvitation` ADD CONSTRAINT `SurveyInvitation_organizationId_revisionId_fkey` FOREIGN KEY (`organizationId`, `revisionId`) REFERENCES `SurveyRevision`(`organizationId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SurveyInvitation` ADD CONSTRAINT `SurveyInvitation_organizationId_distributionId_fkey` FOREIGN KEY (`organizationId`, `distributionId`) REFERENCES `SurveyDistribution`(`organizationId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SurveyResponse` ADD CONSTRAINT `SurveyResponse_organizationId_revisionId_fkey` FOREIGN KEY (`organizationId`, `revisionId`) REFERENCES `SurveyRevision`(`organizationId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SurveyResponse` ADD CONSTRAINT `SurveyResponse_organizationId_invitationId_fkey` FOREIGN KEY (`organizationId`, `invitationId`) REFERENCES `SurveyInvitation`(`organizationId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SurveyDeliveryJob` ADD CONSTRAINT `SurveyDeliveryJob_organizationId_invitationId_fkey` FOREIGN KEY (`organizationId`, `invitationId`) REFERENCES `SurveyInvitation`(`organizationId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;
