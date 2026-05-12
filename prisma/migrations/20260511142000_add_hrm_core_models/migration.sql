-- CreateTable
CREATE TABLE `HrmLocation` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'America/Chicago',
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `addressLine1` VARCHAR(191) NULL,
    `addressLine2` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `state` VARCHAR(191) NULL,
    `zip` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `HrmLocation_organizationId_name_key`(`organizationId`, `name`),
    UNIQUE INDEX `HrmLocation_organizationId_code_key`(`organizationId`, `code`),
    INDEX `HrmLocation_organizationId_status_idx`(`organizationId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HrmMessage` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `senderUserId` VARCHAR(191) NOT NULL,
    `recipientUserId` VARCHAR(191) NULL,
    `recipientRole` VARCHAR(191) NULL,
    `kind` ENUM('DIRECT', 'ANNOUNCEMENT') NOT NULL DEFAULT 'DIRECT',
    `priority` ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT') NOT NULL DEFAULT 'NORMAL',
    `broadcastAll` BOOLEAN NOT NULL DEFAULT false,
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `readAt` DATETIME(3) NULL,
    `archivedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `HrmMessage_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
    INDEX `HrmMessage_organizationId_recipientUserId_readAt_idx`(`organizationId`, `recipientUserId`, `readAt`),
    INDEX `HrmMessage_organizationId_recipientRole_readAt_idx`(`organizationId`, `recipientRole`, `readAt`),
    INDEX `HrmMessage_organizationId_senderUserId_idx`(`organizationId`, `senderUserId`),
    INDEX `HrmMessage_organizationId_kind_idx`(`organizationId`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HrmSetting` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `defaultTimezone` VARCHAR(191) NOT NULL DEFAULT 'America/Chicago',
    `defaultLocationId` VARCHAR(191) NULL,
    `allowCompassionAssignmentSync` BOOLEAN NOT NULL DEFAULT true,
    `requireSchedulableFlag` BOOLEAN NOT NULL DEFAULT true,
    `messageDigestEnabled` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `HrmSetting_organizationId_key`(`organizationId`),
    INDEX `HrmSetting_organizationId_idx`(`organizationId`),
    INDEX `HrmSetting_defaultLocationId_idx`(`defaultLocationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `HrmLocation` ADD CONSTRAINT `HrmLocation_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HrmMessage` ADD CONSTRAINT `HrmMessage_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HrmMessage` ADD CONSTRAINT `HrmMessage_senderUserId_fkey` FOREIGN KEY (`senderUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HrmMessage` ADD CONSTRAINT `HrmMessage_recipientUserId_fkey` FOREIGN KEY (`recipientUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HrmSetting` ADD CONSTRAINT `HrmSetting_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HrmSetting` ADD CONSTRAINT `HrmSetting_defaultLocationId_fkey` FOREIGN KEY (`defaultLocationId`) REFERENCES `HrmLocation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
