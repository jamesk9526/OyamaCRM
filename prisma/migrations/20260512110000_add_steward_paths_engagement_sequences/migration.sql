-- CreateTable
CREATE TABLE `StewardPath` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `crmScope` ENUM('DONOR', 'COMPASSION', 'EVENTS', 'HRM', 'GLOBAL') NOT NULL DEFAULT 'DONOR',
    `targetType` ENUM('CONSTITUENT', 'DONOR', 'CLIENT', 'EVENT_ATTENDEE', 'SPONSOR', 'GRANT', 'STAFF', 'CUSTOM') NOT NULL,
    `triggerType` VARCHAR(191) NOT NULL DEFAULT 'MANUAL',
    `triggerConfig` JSON NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `defaultOwnerId` VARCHAR(191) NULL,
    `createdByUserId` VARCHAR(191) NOT NULL,
    `lastEditedByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StewardPath_organizationId_status_idx`(`organizationId`, `status`),
    INDEX `StewardPath_organizationId_crmScope_targetType_idx`(`organizationId`, `crmScope`, `targetType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StewardPathStep` (
    `id` VARCHAR(191) NOT NULL,
    `pathId` VARCHAR(191) NOT NULL,
    `orderIndex` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `stepType` ENUM('DELAY', 'CREATE_TASK', 'DRAFT_EMAIL', 'SEND_EMAIL', 'MANUAL_ACTION', 'INTERNAL_NOTE', 'STATUS_CHANGE', 'BRANCH_PLACEHOLDER') NOT NULL,
    `configJson` JSON NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT true,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `StewardPathStep_pathId_orderIndex_key`(`pathId`, `orderIndex`),
    INDEX `StewardPathStep_pathId_isActive_orderIndex_idx`(`pathId`, `isActive`, `orderIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StewardPathEnrollment` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `pathId` VARCHAR(191) NOT NULL,
    `targetType` ENUM('CONSTITUENT', 'DONOR', 'CLIENT', 'EVENT_ATTENDEE', 'SPONSOR', 'GRANT', 'STAFF', 'CUSTOM') NOT NULL,
    `targetId` VARCHAR(191) NOT NULL,
    `constituentId` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED', 'FAILED') NOT NULL DEFAULT 'ACTIVE',
    `currentStepId` VARCHAR(191) NULL,
    `ownerUserId` VARCHAR(191) NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastStepCompletedAt` DATETIME(3) NULL,
    `nextStepDueAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `pausedAt` DATETIME(3) NULL,
    `pausedReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StewardPathEnrollment_organizationId_status_nextStepDueAt_idx`(`organizationId`, `status`, `nextStepDueAt`),
    INDEX `StewardPathEnrollment_pathId_status_idx`(`pathId`, `status`),
    INDEX `StewardPathEnrollment_targetType_targetId_idx`(`targetType`, `targetId`),
    INDEX `StewardPathEnrollment_constituentId_idx`(`constituentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StewardPathStepRun` (
    `id` VARCHAR(191) NOT NULL,
    `enrollmentId` VARCHAR(191) NOT NULL,
    `stepId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'SKIPPED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `scheduledFor` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `resultJson` JSON NULL,
    `errorMessage` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `StewardPathStepRun_enrollmentId_stepId_key`(`enrollmentId`, `stepId`),
    INDEX `StewardPathStepRun_status_scheduledFor_idx`(`status`, `scheduledFor`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StewardPathTimelineEvent` (
    `id` VARCHAR(191) NOT NULL,
    `enrollmentId` VARCHAR(191) NOT NULL,
    `stepId` VARCHAR(191) NULL,
    `eventType` ENUM('PATH_STARTED', 'STEP_SCHEDULED', 'STEP_STARTED', 'TASK_CREATED', 'EMAIL_DRAFT_CREATED', 'EMAIL_SENT', 'STEP_COMPLETED', 'STEP_SKIPPED', 'PATH_PAUSED', 'PATH_RESUMED', 'PATH_COMPLETED', 'PATH_FAILED') NOT NULL,
    `message` TEXT NOT NULL,
    `metadataJson` JSON NULL,
    `createdByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `StewardPathTimelineEvent_enrollmentId_createdAt_idx`(`enrollmentId`, `createdAt`),
    INDEX `StewardPathTimelineEvent_eventType_createdAt_idx`(`eventType`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StewardPathEmailDraft` (
    `id` VARCHAR(191) NOT NULL,
    `enrollmentId` VARCHAR(191) NOT NULL,
    `stepId` VARCHAR(191) NOT NULL,
    `constituentId` VARCHAR(191) NULL,
    `reviewerUserId` VARCHAR(191) NULL,
    `status` ENUM('DRAFT_CREATED', 'EDITED', 'APPROVED', 'SENT', 'SKIPPED', 'FAILED') NOT NULL DEFAULT 'DRAFT_CREATED',
    `subject` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `fromMode` VARCHAR(191) NOT NULL DEFAULT 'organization',
    `replyToMode` VARCHAR(191) NULL,
    `requireApproval` BOOLEAN NOT NULL DEFAULT true,
    `allowUserEdits` BOOLEAN NOT NULL DEFAULT true,
    `sentAt` DATETIME(3) NULL,
    `skippedAt` DATETIME(3) NULL,
    `failedAt` DATETIME(3) NULL,
    `failureReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StewardPathEmailDraft_reviewerUserId_status_idx`(`reviewerUserId`, `status`),
    INDEX `StewardPathEmailDraft_enrollmentId_status_idx`(`enrollmentId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `StewardPath` ADD CONSTRAINT `StewardPath_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StewardPath` ADD CONSTRAINT `StewardPath_defaultOwnerId_fkey` FOREIGN KEY (`defaultOwnerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StewardPath` ADD CONSTRAINT `StewardPath_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StewardPath` ADD CONSTRAINT `StewardPath_lastEditedByUserId_fkey` FOREIGN KEY (`lastEditedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StewardPathStep` ADD CONSTRAINT `StewardPathStep_pathId_fkey` FOREIGN KEY (`pathId`) REFERENCES `StewardPath`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StewardPathEnrollment` ADD CONSTRAINT `StewardPathEnrollment_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StewardPathEnrollment` ADD CONSTRAINT `StewardPathEnrollment_pathId_fkey` FOREIGN KEY (`pathId`) REFERENCES `StewardPath`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StewardPathEnrollment` ADD CONSTRAINT `StewardPathEnrollment_currentStepId_fkey` FOREIGN KEY (`currentStepId`) REFERENCES `StewardPathStep`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StewardPathEnrollment` ADD CONSTRAINT `StewardPathEnrollment_ownerUserId_fkey` FOREIGN KEY (`ownerUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StewardPathEnrollment` ADD CONSTRAINT `StewardPathEnrollment_constituentId_fkey` FOREIGN KEY (`constituentId`) REFERENCES `Constituent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StewardPathStepRun` ADD CONSTRAINT `StewardPathStepRun_enrollmentId_fkey` FOREIGN KEY (`enrollmentId`) REFERENCES `StewardPathEnrollment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StewardPathStepRun` ADD CONSTRAINT `StewardPathStepRun_stepId_fkey` FOREIGN KEY (`stepId`) REFERENCES `StewardPathStep`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StewardPathTimelineEvent` ADD CONSTRAINT `StewardPathTimelineEvent_enrollmentId_fkey` FOREIGN KEY (`enrollmentId`) REFERENCES `StewardPathEnrollment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StewardPathTimelineEvent` ADD CONSTRAINT `StewardPathTimelineEvent_stepId_fkey` FOREIGN KEY (`stepId`) REFERENCES `StewardPathStep`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StewardPathTimelineEvent` ADD CONSTRAINT `StewardPathTimelineEvent_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StewardPathEmailDraft` ADD CONSTRAINT `StewardPathEmailDraft_enrollmentId_fkey` FOREIGN KEY (`enrollmentId`) REFERENCES `StewardPathEnrollment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StewardPathEmailDraft` ADD CONSTRAINT `StewardPathEmailDraft_stepId_fkey` FOREIGN KEY (`stepId`) REFERENCES `StewardPathStep`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StewardPathEmailDraft` ADD CONSTRAINT `StewardPathEmailDraft_constituentId_fkey` FOREIGN KEY (`constituentId`) REFERENCES `Constituent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StewardPathEmailDraft` ADD CONSTRAINT `StewardPathEmailDraft_reviewerUserId_fkey` FOREIGN KEY (`reviewerUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
