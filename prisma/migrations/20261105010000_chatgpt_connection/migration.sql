-- Additive, hashed OAuth credentials and idempotent letter-draft receipts.

CREATE TABLE `ChatGptGrant` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `redirectUri` TEXT NOT NULL,
    `resource` TEXT NOT NULL,
    `scopes` VARCHAR(191) NOT NULL,
    `challenge` VARCHAR(191) NOT NULL,
    `codeHash` VARCHAR(64) NULL,
    `codeExpiresAt` DATETIME(3) NOT NULL,
    `accessHash` VARCHAR(64) NULL,
    `accessExpiresAt` DATETIME(3) NULL,
    `refreshHash` VARCHAR(64) NULL,
    `refreshExpiresAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `lastUsedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ChatGptGrant_codeHash_key`(`codeHash`),
    UNIQUE INDEX `ChatGptGrant_accessHash_key`(`accessHash`),
    UNIQUE INDEX `ChatGptGrant_refreshHash_key`(`refreshHash`),
    INDEX `ChatGptGrant_userId_organizationId_revokedAt_idx`(`userId`, `organizationId`, `revokedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ChatGptDraftRequest` (
    `id` VARCHAR(191) NOT NULL,
    `grantId` VARCHAR(191) NOT NULL,
    `requestKey` VARCHAR(100) NOT NULL,
    `fingerprint` VARCHAR(64) NOT NULL,
    `resultJson` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ChatGptDraftRequest_grantId_requestKey_key`(`grantId`, `requestKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
