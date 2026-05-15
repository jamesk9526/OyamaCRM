-- Local non-destructive patch for drifted MySQL dev databases
-- Applies additive schema changes needed by task/notification work-engine routes

ALTER TABLE `task`
  ADD COLUMN `organizationId` VARCHAR(191) NULL,
  ADD COLUMN `completedById` VARCHAR(191) NULL,
  ADD COLUMN `reminderAt` DATETIME(3) NULL,
  ADD COLUMN `snoozedUntil` DATETIME(3) NULL,
  ADD COLUMN `archivedAt` DATETIME(3) NULL,
  ADD COLUMN `outcome` TEXT NULL,
  ADD COLUMN `sourceModule` VARCHAR(191) NULL,
  ADD COLUMN `sourceType` VARCHAR(191) NULL,
  ADD COLUMN `sourceId` VARCHAR(191) NULL,
  ADD COLUMN `checklistJson` JSON NULL,
  ADD COLUMN `metadata` JSON NULL;

CREATE TABLE `tasktemplatepreset` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `taskType` ENUM('CALL', 'EMAIL', 'MAIL', 'MEETING', 'THANK_YOU', 'FOLLOW_UP', 'OTHER') NOT NULL DEFAULT 'FOLLOW_UP',
  `defaultPriority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
  `defaultDueOffsetDays` INTEGER NOT NULL DEFAULT 1,
  `description` TEXT NULL,
  `checklistJson` JSON NULL,
  `suggestedReminderHours` INTEGER NULL,
  `workflowCategory` VARCHAR(191) NULL,
  `isBuiltIn` BOOLEAN NOT NULL DEFAULT false,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `tasktemplatepreset_organizationId_name_key`(`organizationId`, `name`),
  INDEX `tasktemplatepreset_organizationId_isActive_idx`(`organizationId`, `isActive`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `notification` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `module` VARCHAR(191) NOT NULL,
  `sourceType` VARCHAR(191) NOT NULL,
  `sourceId` VARCHAR(191) NULL,
  `title` VARCHAR(191) NOT NULL,
  `message` TEXT NOT NULL,
  `href` VARCHAR(191) NOT NULL,
  `severity` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
  `status` ENUM('UNREAD', 'READ', 'DISMISSED', 'ARCHIVED') NOT NULL DEFAULT 'UNREAD',
  `actionLabel` VARCHAR(191) NULL,
  `metadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `readAt` DATETIME(3) NULL,
  `dismissedAt` DATETIME(3) NULL,
  `snoozedUntil` DATETIME(3) NULL,
  `expiresAt` DATETIME(3) NULL,
  `archivedAt` DATETIME(3) NULL,
  INDEX `notification_organizationId_userId_status_idx`(`organizationId`, `userId`, `status`),
  INDEX `notification_organizationId_userId_createdAt_idx`(`organizationId`, `userId`, `createdAt`),
  INDEX `notification_userId_snoozedUntil_idx`(`userId`, `snoozedUntil`),
  INDEX `notification_sourceType_sourceId_idx`(`sourceType`, `sourceId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `task_organizationId_idx` ON `task`(`organizationId`);
CREATE INDEX `task_assigneeId_status_dueDate_idx` ON `task`(`assigneeId`, `status`, `dueDate`);
CREATE INDEX `task_status_archivedAt_idx` ON `task`(`status`, `archivedAt`);
CREATE INDEX `task_sourceModule_sourceType_sourceId_idx` ON `task`(`sourceModule`, `sourceType`, `sourceId`);

ALTER TABLE `task` ADD CONSTRAINT `task_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organization`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `task` ADD CONSTRAINT `task_completedById_fkey` FOREIGN KEY (`completedById`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `tasktemplatepreset` ADD CONSTRAINT `tasktemplatepreset_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `notification` ADD CONSTRAINT `notification_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `notification` ADD CONSTRAINT `notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
