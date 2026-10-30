CREATE TABLE `CommunityPost` (
 `id` VARCHAR(191) NOT NULL, `organizationId` VARCHAR(191) NOT NULL, `authorId` VARCHAR(191) NOT NULL, `requestId` VARCHAR(191) NOT NULL,
 `body` TEXT NOT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL, `deletedAt` DATETIME(3) NULL,
 PRIMARY KEY (`id`), UNIQUE INDEX `CommunityPost_requestId_key` (`requestId`), INDEX `CommunityPost_organizationId_deletedAt_createdAt_idx` (`organizationId`,`deletedAt`,`createdAt`),
 CONSTRAINT `CommunityPost_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT `CommunityPost_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `CommunityReply` (
 `id` VARCHAR(191) NOT NULL, `postId` VARCHAR(191) NOT NULL, `authorId` VARCHAR(191) NOT NULL, `requestId` VARCHAR(191) NOT NULL,
 `body` TEXT NOT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `deletedAt` DATETIME(3) NULL,
 PRIMARY KEY (`id`), UNIQUE INDEX `CommunityReply_requestId_key` (`requestId`), INDEX `CommunityReply_postId_deletedAt_createdAt_idx` (`postId`,`deletedAt`,`createdAt`),
 CONSTRAINT `CommunityReply_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `CommunityPost` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT `CommunityReply_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `CommunityReaction` (
 `postId` VARCHAR(191) NOT NULL, `userId` VARCHAR(191) NOT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY (`postId`,`userId`),
 CONSTRAINT `CommunityReaction_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `CommunityPost` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT `CommunityReaction_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
