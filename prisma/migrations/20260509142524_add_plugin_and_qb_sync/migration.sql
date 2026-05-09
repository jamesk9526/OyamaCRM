-- CreateTable
CREATE TABLE `PluginSetting` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `pluginKey` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `config` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PluginSetting_organizationId_idx`(`organizationId`),
    UNIQUE INDEX `PluginSetting_organizationId_pluginKey_key`(`organizationId`, `pluginKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QBSyncQueueItem` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `donationId` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'SYNCED', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `customerName` VARCHAR(191) NULL,
    `qbAccount` VARCHAR(191) NULL,
    `memo` VARCHAR(191) NULL,
    `amount` DECIMAL(12, 2) NULL,
    `qbEntityId` VARCHAR(191) NULL,
    `errorMessage` TEXT NULL,
    `syncedAt` DATETIME(3) NULL,
    `attemptCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `QBSyncQueueItem_organizationId_status_idx`(`organizationId`, `status`),
    INDEX `QBSyncQueueItem_donationId_idx`(`donationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PluginSetting` ADD CONSTRAINT `PluginSetting_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QBSyncQueueItem` ADD CONSTRAINT `QBSyncQueueItem_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QBSyncQueueItem` ADD CONSTRAINT `QBSyncQueueItem_donationId_fkey` FOREIGN KEY (`donationId`) REFERENCES `Donation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
