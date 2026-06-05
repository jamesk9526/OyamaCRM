CREATE TABLE `ConstituentGroup` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `groupType` VARCHAR(191) NOT NULL DEFAULT 'ORGANIZATION',
  `description` TEXT NULL,
  `primaryConstituentId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `ConstituentGroup_organizationId_groupType_idx`(`organizationId`, `groupType`),
  INDEX `ConstituentGroup_primaryConstituentId_idx`(`primaryConstituentId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ConstituentGroupMember` (
  `id` VARCHAR(191) NOT NULL,
  `groupId` VARCHAR(191) NOT NULL,
  `constituentId` VARCHAR(191) NOT NULL,
  `relationshipLabel` VARCHAR(191) NULL,
  `isPrimary` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ConstituentGroupMember_groupId_constituentId_key`(`groupId`, `constituentId`),
  INDEX `ConstituentGroupMember_constituentId_idx`(`constituentId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ConstituentGroup`
  ADD CONSTRAINT `ConstituentGroup_organizationId_fkey`
    FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ConstituentGroup_primaryConstituentId_fkey`
    FOREIGN KEY (`primaryConstituentId`) REFERENCES `Constituent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ConstituentGroupMember`
  ADD CONSTRAINT `ConstituentGroupMember_groupId_fkey`
    FOREIGN KEY (`groupId`) REFERENCES `ConstituentGroup`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ConstituentGroupMember_constituentId_fkey`
    FOREIGN KEY (`constituentId`) REFERENCES `Constituent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
