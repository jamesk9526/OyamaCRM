-- AlterTable
ALTER TABLE `compassionactivity` ADD COLUMN `performedByCompassionStaffId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `compassionappointment` ADD COLUMN `assignedCompassionStaffId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `compassioncase` ADD COLUMN `assignedCompassionStaffId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `compassionclient` ADD COLUMN `assignedCompassionStaffId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `compassionfollowup` ADD COLUMN `assignedCompassionStaffId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `compassionservice` ADD COLUMN `providedByCompassionStaffId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `emailrecipientlist` MODIFY `description` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `organizationsettings` ADD COLUMN `compassionWorkspaceEnabled` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `defaultWorkspace` VARCHAR(191) NOT NULL DEFAULT 'donor',
    ADD COLUMN `donorWorkspaceEnabled` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `showModuleSwitcher` BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE `WebmasterSite` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `domain` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WebmasterSite_organizationId_status_idx`(`organizationId`, `status`),
    UNIQUE INDEX `WebmasterSite_organizationId_slug_key`(`organizationId`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WebmasterPage` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `path` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'REVIEW_READY', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `contentJson` JSON NULL,
    `seoTitle` VARCHAR(191) NULL,
    `seoDescription` VARCHAR(191) NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WebmasterPage_organizationId_status_updatedAt_idx`(`organizationId`, `status`, `updatedAt`),
    UNIQUE INDEX `WebmasterPage_siteId_slug_key`(`siteId`, `slug`),
    UNIQUE INDEX `WebmasterPage_siteId_path_key`(`siteId`, `path`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompassionStaff` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `linkedUserId` VARCHAR(191) NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NULL,
    `title` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `supportsScheduling` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CompassionStaff_linkedUserId_key`(`linkedUserId`),
    INDEX `CompassionStaff_organizationId_isActive_idx`(`organizationId`, `isActive`),
    UNIQUE INDEX `CompassionStaff_organizationId_email_key`(`organizationId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `WebmasterSite` ADD CONSTRAINT `WebmasterSite_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WebmasterSite` ADD CONSTRAINT `WebmasterSite_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WebmasterPage` ADD CONSTRAINT `WebmasterPage_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WebmasterPage` ADD CONSTRAINT `WebmasterPage_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `WebmasterSite`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WebmasterPage` ADD CONSTRAINT `WebmasterPage_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WebmasterPage` ADD CONSTRAINT `WebmasterPage_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompassionStaff` ADD CONSTRAINT `CompassionStaff_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompassionStaff` ADD CONSTRAINT `CompassionStaff_linkedUserId_fkey` FOREIGN KEY (`linkedUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompassionClient` ADD CONSTRAINT `CompassionClient_assignedCompassionStaffId_fkey` FOREIGN KEY (`assignedCompassionStaffId`) REFERENCES `CompassionStaff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompassionCase` ADD CONSTRAINT `CompassionCase_assignedCompassionStaffId_fkey` FOREIGN KEY (`assignedCompassionStaffId`) REFERENCES `CompassionStaff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompassionAppointment` ADD CONSTRAINT `CompassionAppointment_assignedCompassionStaffId_fkey` FOREIGN KEY (`assignedCompassionStaffId`) REFERENCES `CompassionStaff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompassionService` ADD CONSTRAINT `CompassionService_providedByCompassionStaffId_fkey` FOREIGN KEY (`providedByCompassionStaffId`) REFERENCES `CompassionStaff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompassionFollowUp` ADD CONSTRAINT `CompassionFollowUp_assignedCompassionStaffId_fkey` FOREIGN KEY (`assignedCompassionStaffId`) REFERENCES `CompassionStaff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompassionActivity` ADD CONSTRAINT `CompassionActivity_performedByCompassionStaffId_fkey` FOREIGN KEY (`performedByCompassionStaffId`) REFERENCES `CompassionStaff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
