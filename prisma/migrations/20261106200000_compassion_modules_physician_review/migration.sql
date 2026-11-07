CREATE TABLE IF NOT EXISTS `CompassionReviewerAuthenticator` (
  `id` VARCHAR(191) NOT NULL, `organizationId` VARCHAR(191) NOT NULL, `userId` VARCHAR(191) NOT NULL,
  `encryptedSecret` TEXT NOT NULL, `recoveryHashes` JSON NOT NULL, `lastStep` BIGINT NOT NULL DEFAULT 0,
  `verifiedAt` DATETIME(3) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE INDEX `CompassionReviewerAuthenticator_organizationId_userId_key` (`organizationId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `CompassionReviewerSession` (
  `id` VARCHAR(191) NOT NULL, `organizationId` VARCHAR(191) NOT NULL, `userId` VARCHAR(191) NOT NULL,
  `tokenHash` VARCHAR(64) NOT NULL, `csrfHash` VARCHAR(64) NOT NULL, `accountVersion` DATETIME(3) NOT NULL,
  `membershipVersion` DATETIME(3) NOT NULL, `mfaFailures` INTEGER NOT NULL DEFAULT 0, `mfaAt` DATETIME(3) NOT NULL, `lastActivityAt` DATETIME(3) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL, `revokedAt` DATETIME(3) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), UNIQUE INDEX `CompassionReviewerSession_tokenHash_key` (`tokenHash`), INDEX `CompassionReviewerSession_organizationId_userId_idx` (`organizationId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `CompassionReviewerChallenge` (
  `id` VARCHAR(191) NOT NULL, `organizationId` VARCHAR(191) NOT NULL, `userId` VARCHAR(191) NOT NULL,
  `tokenHash` VARCHAR(64) NOT NULL, `expiresAt` DATETIME(3) NOT NULL, `attempts` INTEGER NOT NULL DEFAULT 0,
  `usedAt` DATETIME(3) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), UNIQUE INDEX `CompassionReviewerChallenge_tokenHash_key` (`tokenHash`), INDEX `CompassionReviewerChallenge_organizationId_userId_createdAt_idx` (`organizationId`, `userId`, `createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
