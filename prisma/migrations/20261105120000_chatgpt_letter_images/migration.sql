CREATE TABLE `ChatGptImageJob` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `grantId` VARCHAR(191) NOT NULL,
    `requestKey` VARCHAR(100) NOT NULL,
    `fingerprint` VARCHAR(64) NOT NULL,
    `quotaDay` VARCHAR(10) NOT NULL,
    `quotaSlot` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `prompt` TEXT NULL,
    `shape` VARCHAR(12) NOT NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'QUEUED',
    `assetId` VARCHAR(191) NULL,
    `error` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `startedAt` DATETIME(3) NULL,

    UNIQUE INDEX `ChatGptImageJob_grantId_requestKey_key`(`grantId`, `requestKey`),
    UNIQUE INDEX `ChatGptImageJob_organizationId_quotaDay_quotaSlot_key`(`organizationId`, `quotaDay`, `quotaSlot`),
    INDEX `ChatGptImageJob_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
