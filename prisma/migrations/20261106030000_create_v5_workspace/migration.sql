ALTER TABLE `OrganizationSettings`
  ADD COLUMN `oyamaCreateV5ShellEnabled` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `oyamaCreateUnifiedEditorEnabled` BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE `CreateContentNote` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `contentId` VARCHAR(191) NOT NULL,
  `text` LONGTEXT NOT NULL,
  `revision` INTEGER NOT NULL DEFAULT 1,
  `updatedBy` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `CreateContentNote_contentId_key` (`contentId`),
  INDEX `CreateContentNote_organizationId_contentId_idx` (`organizationId`, `contentId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `CreateContentNote_contentId_fkey` FOREIGN KEY (`contentId`) REFERENCES `CreateContent` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
