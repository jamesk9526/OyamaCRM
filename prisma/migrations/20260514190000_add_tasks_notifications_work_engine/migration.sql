-- AlterTable
ALTER TABLE `Task`
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

-- CreateTable
CREATE TABLE `TaskTemplatePreset` (
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

  UNIQUE INDEX `TaskTemplatePreset_organizationId_name_key`(`organizationId`, `name`),
  INDEX `TaskTemplatePreset_organizationId_isActive_idx`(`organizationId`, `isActive`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
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

  INDEX `Notification_organizationId_userId_status_idx`(`organizationId`, `userId`, `status`),
  INDEX `Notification_organizationId_userId_createdAt_idx`(`organizationId`, `userId`, `createdAt`),
  INDEX `Notification_userId_snoozedUntil_idx`(`userId`, `snoozedUntil`),
  INDEX `Notification_sourceType_sourceId_idx`(`sourceType`, `sourceId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Task_organizationId_idx` ON `Task`(`organizationId`);

-- CreateIndex
CREATE INDEX `Task_assigneeId_status_dueDate_idx` ON `Task`(`assigneeId`, `status`, `dueDate`);

-- CreateIndex
CREATE INDEX `Task_status_archivedAt_idx` ON `Task`(`status`, `archivedAt`);

-- CreateIndex
CREATE INDEX `Task_sourceModule_sourceType_sourceId_idx` ON `Task`(`sourceModule`, `sourceType`, `sourceId`);

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_completedById_fkey` FOREIGN KEY (`completedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskTemplatePreset` ADD CONSTRAINT `TaskTemplatePreset_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
