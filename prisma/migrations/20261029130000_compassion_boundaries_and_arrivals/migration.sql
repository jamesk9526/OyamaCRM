-- Additional client-care boundaries, identity redirects, and arrival tracking.
CREATE TABLE IF NOT EXISTS `CompassionConfiguration` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `pluginKey` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `config` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CompassionConfiguration_organizationId_pluginKey_key`(`organizationId`, `pluginKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CompassionClientRedirect` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `targetId` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CompassionClientRedirect_sourceId_key`(`sourceId`),
    INDEX `CompassionClientRedirect_organizationId_targetId_idx`(`organizationId`, `targetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CompassionAppointment` MODIFY `status` ENUM('SCHEDULED','COMPLETED','CANCELLED','NO_SHOW','RESCHEDULED','CHECKED_IN') NOT NULL DEFAULT 'SCHEDULED';
SET @care_column_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND LOWER(table_name) = 'compassionresource' AND column_name = 'staffId');
SET @care_ddl = IF(@care_column_exists = 0, 'ALTER TABLE `CompassionResource` ADD COLUMN `staffId` VARCHAR(191) NULL', 'SELECT 1');
PREPARE care_stmt FROM @care_ddl;
EXECUTE care_stmt;
DEALLOCATE PREPARE care_stmt;
