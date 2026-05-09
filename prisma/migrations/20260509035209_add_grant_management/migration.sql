-- CreateTable
CREATE TABLE `GrantFunder` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('GOVERNMENT', 'PRIVATE_FOUNDATION', 'CORPORATE', 'COMMUNITY', 'FAITH_BASED', 'INDIVIDUAL', 'OTHER') NOT NULL DEFAULT 'PRIVATE_FOUNDATION',
    `website` VARCHAR(191) NULL,
    `contactName` VARCHAR(191) NULL,
    `contactEmail` VARCHAR(191) NULL,
    `contactPhone` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Grant` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `funderId` VARCHAR(191) NOT NULL,
    `assigneeId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `programArea` VARCHAR(191) NULL,
    `status` ENUM('IDEA', 'RESEARCH', 'LOI_DRAFT', 'LOI_SUBMITTED', 'PROPOSAL_DRAFT', 'PROPOSAL_SUBMITTED', 'UNDER_REVIEW', 'AWARDED', 'REJECTED', 'WITHDRAWN', 'CLOSED') NOT NULL DEFAULT 'IDEA',
    `amountRequested` DECIMAL(12, 2) NULL,
    `amountAwarded` DECIMAL(12, 2) NULL,
    `requiresLOI` BOOLEAN NOT NULL DEFAULT false,
    `loiDeadline` DATETIME(3) NULL,
    `loiSubmittedAt` DATETIME(3) NULL,
    `applicationDeadline` DATETIME(3) NULL,
    `submittedAt` DATETIME(3) NULL,
    `awardedAt` DATETIME(3) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `grantPeriodStart` DATETIME(3) NULL,
    `grantPeriodEnd` DATETIME(3) NULL,
    `reportingDeadline` DATETIME(3) NULL,
    `reportingSubmittedAt` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `internalNotes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GrantSection` (
    `id` VARCHAR(191) NOT NULL,
    `grantId` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` LONGTEXT NULL,
    `wordLimit` INTEGER NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `completed` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `GrantSection_grantId_key_key`(`grantId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GrantActivity` (
    `id` VARCHAR(191) NOT NULL,
    `grantId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `type` ENUM('NOTE', 'STATUS_CHANGE', 'LOI_SUBMITTED', 'PROPOSAL_SUBMITTED', 'AWARD_NOTIFICATION', 'REJECTION_NOTIFICATION', 'REPORTING_SUBMITTED', 'DOCUMENT_ADDED', 'OTHER') NOT NULL DEFAULT 'NOTE',
    `description` TEXT NOT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `GrantFunder` ADD CONSTRAINT `GrantFunder_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Grant` ADD CONSTRAINT `Grant_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Grant` ADD CONSTRAINT `Grant_funderId_fkey` FOREIGN KEY (`funderId`) REFERENCES `GrantFunder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Grant` ADD CONSTRAINT `Grant_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GrantSection` ADD CONSTRAINT `GrantSection_grantId_fkey` FOREIGN KEY (`grantId`) REFERENCES `Grant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GrantActivity` ADD CONSTRAINT `GrantActivity_grantId_fkey` FOREIGN KEY (`grantId`) REFERENCES `Grant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GrantActivity` ADD CONSTRAINT `GrantActivity_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
