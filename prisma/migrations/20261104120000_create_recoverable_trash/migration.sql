CREATE TABLE `CreateTrashItem` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `kind` VARCHAR(191) NOT NULL,
  `resourceId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `revision` INTEGER NOT NULL DEFAULT 1,
  `removedBy` VARCHAR(191) NOT NULL,
  `removedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `restoredAt` DATETIME(3) NULL,
  UNIQUE INDEX `CreateTrashItem_organizationId_kind_resourceId_key` (`organizationId`, `kind`, `resourceId`),
  INDEX `CreateTrashItem_organizationId_restoredAt_removedAt_idx` (`organizationId`, `restoredAt`, `removedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
