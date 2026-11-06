CREATE TABLE `QuickBooksSyncMutex` (
  `organizationId` VARCHAR(191) NOT NULL,
  PRIMARY KEY (`organizationId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
