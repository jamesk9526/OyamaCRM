CREATE TABLE `QrCodeLink` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `createdById` VARCHAR(191) NULL,
  `name` VARCHAR(160) NOT NULL,
  `slug` VARCHAR(64) NOT NULL,
  `destinationUrl` TEXT NOT NULL,
  `notes` TEXT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `expiresAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `QrCodeLink_slug_key`(`slug`),
  INDEX `QrCodeLink_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
  INDEX `QrCodeLink_organizationId_active_idx`(`organizationId`, `active`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `QrCodeScan` (
  `id` VARCHAR(191) NOT NULL,
  `qrCodeLinkId` VARCHAR(191) NOT NULL,
  `scannedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `visitorHash` VARCHAR(64) NULL,
  `deviceType` VARCHAR(24) NOT NULL DEFAULT 'unknown',
  `referrer` VARCHAR(500) NULL,
  INDEX `QrCodeScan_qrCodeLinkId_scannedAt_idx`(`qrCodeLinkId`, `scannedAt`),
  INDEX `QrCodeScan_qrCodeLinkId_visitorHash_idx`(`qrCodeLinkId`, `visitorHash`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `QrCodeLink` ADD CONSTRAINT `QrCodeLink_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `QrCodeLink` ADD CONSTRAINT `QrCodeLink_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `QrCodeScan` ADD CONSTRAINT `QrCodeScan_qrCodeLinkId_fkey` FOREIGN KEY (`qrCodeLinkId`) REFERENCES `QrCodeLink`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
