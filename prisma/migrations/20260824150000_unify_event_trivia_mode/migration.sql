/*
  Unifies Trivia under Event ownership. Existing Event rows remain unchanged;
  the application performs a one-time import from the retired trivia JSON store.
*/

CREATE TABLE `TriviaConfiguration` (
  `id` VARCHAR(191) NOT NULL,
  `eventId` VARCHAR(191) NOT NULL,
  `legacyTriviaId` VARCHAR(191) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
  `hostName` VARCHAR(191) NULL,
  `payload` JSON NULL,
  `liveState` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `TriviaConfiguration_eventId_key`(`eventId`),
  UNIQUE INDEX `TriviaConfiguration_legacyTriviaId_key`(`legacyTriviaId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TriviaRound` (
  `id` VARCHAR(191) NOT NULL,
  `configurationId` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `roundType` VARCHAR(191) NOT NULL,
  `sortOrder` INTEGER NOT NULL,
  `payload` JSON NULL,
  INDEX `TriviaRound_configurationId_sortOrder_idx`(`configurationId`, `sortOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TriviaQuestion` (
  `id` VARCHAR(191) NOT NULL,
  `roundId` VARCHAR(191) NOT NULL,
  `prompt` TEXT NOT NULL,
  `answer` TEXT NOT NULL,
  `points` INTEGER NOT NULL,
  `timerSeconds` INTEGER NOT NULL,
  `sortOrder` INTEGER NOT NULL,
  `payload` JSON NULL,
  INDEX `TriviaQuestion_roundId_sortOrder_idx`(`roundId`, `sortOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TriviaTeam` (
  `id` VARCHAR(191) NOT NULL,
  `configurationId` VARCHAR(191) NOT NULL,
  `eventTableId` VARCHAR(191) NULL,
  `gameName` VARCHAR(191) NULL,
  `score` INTEGER NOT NULL DEFAULT 0,
  `bonusPoints` INTEGER NOT NULL DEFAULT 0,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `payload` JSON NULL,
  UNIQUE INDEX `TriviaTeam_eventTableId_key`(`eventTableId`),
  INDEX `TriviaTeam_configurationId_sortOrder_idx`(`configurationId`, `sortOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TriviaScoreAction` (
  `id` VARCHAR(191) NOT NULL,
  `configurationId` VARCHAR(191) NOT NULL,
  `teamId` VARCHAR(191) NULL,
  `delta` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL,
  `payload` JSON NOT NULL,
  INDEX `TriviaScoreAction_configurationId_createdAt_idx`(`configurationId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TriviaSnapshot` (
  `id` VARCHAR(191) NOT NULL,
  `configurationId` VARCHAR(191) NOT NULL,
  `label` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL,
  `payload` JSON NOT NULL,
  INDEX `TriviaSnapshot_configurationId_createdAt_idx`(`configurationId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TriviaAuditEvent` (
  `id` VARCHAR(191) NOT NULL,
  `configurationId` VARCHAR(191) NOT NULL,
  `type` VARCHAR(191) NOT NULL,
  `message` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL,
  `metadata` JSON NULL,
  INDEX `TriviaAuditEvent_configurationId_createdAt_idx`(`configurationId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TriviaAccessPass` (
  `id` VARCHAR(191) NOT NULL,
  `configurationId` VARCHAR(191) NOT NULL,
  `label` VARCHAR(191) NOT NULL,
  `role` VARCHAR(191) NOT NULL,
  `codeHash` VARCHAR(191) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `revokedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL,
  INDEX `TriviaAccessPass_configurationId_expiresAt_idx`(`configurationId`, `expiresAt`),
  INDEX `TriviaAccessPass_codeHash_idx`(`codeHash`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TriviaAccessSession` (
  `id` VARCHAR(191) NOT NULL,
  `passId` VARCHAR(191) NOT NULL,
  `tokenHash` VARCHAR(191) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  INDEX `TriviaAccessSession_tokenHash_idx`(`tokenHash`),
  INDEX `TriviaAccessSession_passId_expiresAt_idx`(`passId`, `expiresAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `TriviaConfiguration` ADD CONSTRAINT `TriviaConfiguration_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `TriviaRound` ADD CONSTRAINT `TriviaRound_configurationId_fkey` FOREIGN KEY (`configurationId`) REFERENCES `TriviaConfiguration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `TriviaQuestion` ADD CONSTRAINT `TriviaQuestion_roundId_fkey` FOREIGN KEY (`roundId`) REFERENCES `TriviaRound`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `TriviaTeam` ADD CONSTRAINT `TriviaTeam_configurationId_fkey` FOREIGN KEY (`configurationId`) REFERENCES `TriviaConfiguration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `TriviaTeam` ADD CONSTRAINT `TriviaTeam_eventTableId_fkey` FOREIGN KEY (`eventTableId`) REFERENCES `EventTable`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `TriviaScoreAction` ADD CONSTRAINT `TriviaScoreAction_configurationId_fkey` FOREIGN KEY (`configurationId`) REFERENCES `TriviaConfiguration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `TriviaSnapshot` ADD CONSTRAINT `TriviaSnapshot_configurationId_fkey` FOREIGN KEY (`configurationId`) REFERENCES `TriviaConfiguration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `TriviaAuditEvent` ADD CONSTRAINT `TriviaAuditEvent_configurationId_fkey` FOREIGN KEY (`configurationId`) REFERENCES `TriviaConfiguration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `TriviaAccessPass` ADD CONSTRAINT `TriviaAccessPass_configurationId_fkey` FOREIGN KEY (`configurationId`) REFERENCES `TriviaConfiguration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `TriviaAccessSession` ADD CONSTRAINT `TriviaAccessSession_passId_fkey` FOREIGN KEY (`passId`) REFERENCES `TriviaAccessPass`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
