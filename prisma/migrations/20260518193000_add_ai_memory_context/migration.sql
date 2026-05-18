-- Add per-user Steward AI memory and document context tables.

CREATE TABLE `AiMemoryPreference` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `memoryEnabled` BOOLEAN NOT NULL DEFAULT true,
    `fileContextEnabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AiMemoryPreference_userId_key`(`userId`),
    INDEX `AiMemoryPreference_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AiUserMemory` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `content` TEXT NOT NULL,
    `category` VARCHAR(60) NOT NULL DEFAULT 'preference',
    `source` VARCHAR(60) NOT NULL DEFAULT 'manual',
    `confidence` DOUBLE NOT NULL DEFAULT 0.75,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `workspaceScope` VARCHAR(40) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AiUserMemory_organizationId_userId_active_idx`(`organizationId`, `userId`, `active`),
    INDEX `AiUserMemory_organizationId_userId_category_idx`(`organizationId`, `userId`, `category`),
    INDEX `AiUserMemory_organizationId_userId_workspaceScope_idx`(`organizationId`, `userId`, `workspaceScope`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AiContextFile` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(255) NOT NULL,
    `displayName` VARCHAR(255) NOT NULL,
    `mimeType` VARCHAR(120) NOT NULL,
    `fileType` VARCHAR(40) NOT NULL,
    `sizeBytes` INTEGER NOT NULL DEFAULT 0,
    `workspaceScope` VARCHAR(40) NULL,
    `description` TEXT NULL,
    `tags` JSON NULL,
    `indexingStatus` VARCHAR(40) NOT NULL DEFAULT 'pending',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `extractedText` LONGTEXT NULL,
    `contentHash` VARCHAR(128) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `indexedAt` DATETIME(3) NULL,

    INDEX `AiContextFile_organizationId_userId_active_idx`(`organizationId`, `userId`, `active`),
    INDEX `AiContextFile_organizationId_userId_workspaceScope_idx`(`organizationId`, `userId`, `workspaceScope`),
    INDEX `AiContextFile_organizationId_userId_indexingStatus_idx`(`organizationId`, `userId`, `indexingStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AiContextChunk` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `fileId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `chunkIndex` INTEGER NOT NULL,
    `chunkText` TEXT NOT NULL,
    `tokenEstimate` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AiContextChunk_fileId_chunkIndex_key`(`fileId`, `chunkIndex`),
    INDEX `AiContextChunk_organizationId_userId_idx`(`organizationId`, `userId`),
    INDEX `AiContextChunk_organizationId_fileId_idx`(`organizationId`, `fileId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AiMemoryPreference` ADD CONSTRAINT `AiMemoryPreference_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AiMemoryPreference` ADD CONSTRAINT `AiMemoryPreference_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AiUserMemory` ADD CONSTRAINT `AiUserMemory_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AiUserMemory` ADD CONSTRAINT `AiUserMemory_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AiContextFile` ADD CONSTRAINT `AiContextFile_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AiContextFile` ADD CONSTRAINT `AiContextFile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AiContextChunk` ADD CONSTRAINT `AiContextChunk_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AiContextChunk` ADD CONSTRAINT `AiContextChunk_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `AiContextFile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
