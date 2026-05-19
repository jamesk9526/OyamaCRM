-- CreateTable: CrmThread
CREATE TABLE `CrmThread` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'DIRECT',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CrmThread_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: CrmThreadParticipant
CREATE TABLE `CrmThreadParticipant` (
    `id` VARCHAR(191) NOT NULL,
    `threadId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `lastReadAt` DATETIME(3) NULL,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CrmThreadParticipant_threadId_userId_key`(`threadId`, `userId`),
    INDEX `CrmThreadParticipant_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: CrmMessage
CREATE TABLE `CrmMessage` (
    `id` VARCHAR(191) NOT NULL,
    `threadId` VARCHAR(191) NOT NULL,
    `senderId` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CrmMessage_threadId_createdAt_idx`(`threadId`, `createdAt`),
    INDEX `CrmMessage_senderId_idx`(`senderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey: CrmThread -> Organization
ALTER TABLE `CrmThread` ADD CONSTRAINT `CrmThread_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: CrmThreadParticipant -> CrmThread
ALTER TABLE `CrmThreadParticipant` ADD CONSTRAINT `CrmThreadParticipant_threadId_fkey` FOREIGN KEY (`threadId`) REFERENCES `CrmThread`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: CrmThreadParticipant -> User
ALTER TABLE `CrmThreadParticipant` ADD CONSTRAINT `CrmThreadParticipant_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: CrmMessage -> CrmThread
ALTER TABLE `CrmMessage` ADD CONSTRAINT `CrmMessage_threadId_fkey` FOREIGN KEY (`threadId`) REFERENCES `CrmThread`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: CrmMessage -> User (sender)
ALTER TABLE `CrmMessage` ADD CONSTRAINT `CrmMessage_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
