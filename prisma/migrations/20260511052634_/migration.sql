-- AlterTable
ALTER TABLE `EmailRecipientList` MODIFY `description` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `OrganizationSettings` ADD COLUMN `defaultWorkspace` VARCHAR(191) NOT NULL DEFAULT 'donor',
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
