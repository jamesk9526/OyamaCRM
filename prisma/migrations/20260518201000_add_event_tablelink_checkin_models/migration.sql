/*
  EventSTUDIO TableLink + Check-In Phase 2 schema migration.
  Additive only: extends EventTable/EventGuest and introduces new event-scoped models.
*/

-- AlterTable
ALTER TABLE `EventGuest`
  ADD COLUMN `seatId` VARCHAR(191) NULL,
  ADD COLUMN `source` ENUM('ADMIN', 'TABLE_HOST', 'GUEST_SELF_ENTRY', 'IMPORT', 'WALK_IN', 'REPLACEMENT') NOT NULL DEFAULT 'ADMIN',
  ADD COLUMN `qrTokenHash` VARCHAR(191) NULL,
  ADD COLUMN `qrTokenExpiresAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `EventTable`
  ADD COLUMN `tableUid` VARCHAR(191) NOT NULL DEFAULT '',
  ADD COLUMN `publicCode` VARCHAR(191) NULL,
  ADD COLUMN `status` ENUM('DRAFT', 'OPEN', 'SUBMITTED', 'LOCKED', 'EVENT_DAY', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN `sponsorName` VARCHAR(191) NULL,
  ADD COLUMN `hostEmail` VARCHAR(191) NULL,
  ADD COLUMN `hostPhone` VARCHAR(191) NULL,
  ADD COLUMN `accessTokenHash` VARCHAR(191) NULL,
  ADD COLUMN `accessTokenExpiresAt` DATETIME(3) NULL;

-- Backfill tableUid for existing records before unique index creation.
UPDATE `EventTable`
SET `tableUid` = CONCAT('tbl_', `id`)
WHERE `tableUid` = '' OR `tableUid` IS NULL;

-- CreateTable
CREATE TABLE `EventTableSeat` (
  `id` VARCHAR(191) NOT NULL,
  `eventId` VARCHAR(191) NOT NULL,
  `tableId` VARCHAR(191) NOT NULL,
  `seatNumber` INTEGER NOT NULL,
  `status` ENUM('EMPTY', 'RESERVED', 'INVITED', 'CONFIRMED', 'CHECKED_IN', 'CANCELLED') NOT NULL DEFAULT 'EMPTY',
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EventGuestInvite` (
  `id` VARCHAR(191) NOT NULL,
  `eventId` VARCHAR(191) NOT NULL,
  `tableId` VARCHAR(191) NOT NULL,
  `seatId` VARCHAR(191) NULL,
  `guestId` VARCHAR(191) NULL,
  `invitedByUserId` VARCHAR(191) NULL,
  `invitedByHostEmail` VARCHAR(191) NULL,
  `inviteEmail` VARCHAR(191) NULL,
  `invitePhone` VARCHAR(191) NULL,
  `tokenHash` VARCHAR(191) NOT NULL,
  `status` ENUM('CREATED', 'QUEUED', 'SENT', 'OPENED', 'COMPLETED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'CREATED',
  `openedAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `expiresAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EventTableAccessToken` (
  `id` VARCHAR(191) NOT NULL,
  `eventId` VARCHAR(191) NOT NULL,
  `tableId` VARCHAR(191) NOT NULL,
  `hostEmail` VARCHAR(191) NOT NULL,
  `tokenHash` VARCHAR(191) NOT NULL,
  `status` ENUM('ACTIVE', 'USED', 'EXPIRED', 'REVOKED') NOT NULL DEFAULT 'ACTIVE',
  `expiresAt` DATETIME(3) NOT NULL,
  `lastUsedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EventCheckInRecord` (
  `id` VARCHAR(191) NOT NULL,
  `eventId` VARCHAR(191) NOT NULL,
  `guestId` VARCHAR(191) NULL,
  `tableId` VARCHAR(191) NULL,
  `seatId` VARCHAR(191) NULL,
  `method` ENUM('QR_SCAN', 'NAME_SEARCH', 'TABLE_SEARCH', 'MANUAL', 'BULK_TABLE', 'WALK_IN', 'REPLACEMENT') NOT NULL,
  `status` ENUM('CHECKED_IN', 'REVERSED', 'DUPLICATE_ATTEMPT', 'NEEDS_REVIEW') NOT NULL DEFAULT 'CHECKED_IN',
  `checkedInByUserId` VARCHAR(191) NULL,
  `checkInDeviceId` VARCHAR(191) NULL,
  `checkedInAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `reversedAt` DATETIME(3) NULL,
  `reversedByUserId` VARCHAR(191) NULL,
  `notes` TEXT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EventCheckInException` (
  `id` VARCHAR(191) NOT NULL,
  `eventId` VARCHAR(191) NOT NULL,
  `guestId` VARCHAR(191) NULL,
  `tableId` VARCHAR(191) NULL,
  `seatId` VARCHAR(191) NULL,
  `guestName` VARCHAR(191) NULL,
  `claimedTable` VARCHAR(191) NULL,
  `claimedEmail` VARCHAR(191) NULL,
  `claimedPhone` VARCHAR(191) NULL,
  `issueType` ENUM('NOT_FOUND', 'DUPLICATE', 'WRONG_TABLE', 'REPLACEMENT', 'UNCONFIRMED', 'NO_TICKET', 'OTHER') NOT NULL,
  `status` ENUM('OPEN', 'RESOLVED', 'DISMISSED') NOT NULL DEFAULT 'OPEN',
  `notes` TEXT NULL,
  `createdByUserId` VARCHAR(191) NULL,
  `resolvedByUserId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `resolvedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EventEmailLog` (
  `id` VARCHAR(191) NOT NULL,
  `eventId` VARCHAR(191) NOT NULL,
  `tableId` VARCHAR(191) NULL,
  `guestId` VARCHAR(191) NULL,
  `inviteId` VARCHAR(191) NULL,
  `type` ENUM('HOST_ACCESS', 'GUEST_INVITE', 'GUEST_REMINDER', 'GUEST_CONFIRMATION', 'CHECKIN_QR', 'TABLE_ROSTER_REMINDER') NOT NULL,
  `recipientEmail` VARCHAR(191) NOT NULL,
  `status` ENUM('QUEUED', 'SENT', 'FAILED', 'OPENED') NOT NULL DEFAULT 'QUEUED',
  `subject` VARCHAR(191) NULL,
  `providerMessageId` VARCHAR(191) NULL,
  `errorMessage` TEXT NULL,
  `queuedAt` DATETIME(3) NULL,
  `sentAt` DATETIME(3) NULL,
  `openedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Indexes
CREATE UNIQUE INDEX `EventGuest_seatId_key` ON `EventGuest`(`seatId`);
CREATE INDEX `EventGuest_eventId_rsvpStatus_idx` ON `EventGuest`(`eventId`, `rsvpStatus`);
CREATE INDEX `EventGuest_eventId_source_idx` ON `EventGuest`(`eventId`, `source`);
CREATE INDEX `EventGuest_tableId_idx` ON `EventGuest`(`tableId`);
CREATE INDEX `EventGuest_seatId_idx` ON `EventGuest`(`seatId`);

CREATE UNIQUE INDEX `EventTable_tableUid_key` ON `EventTable`(`tableUid`);
CREATE UNIQUE INDEX `EventTable_eventId_publicCode_key` ON `EventTable`(`eventId`, `publicCode`);
CREATE INDEX `EventTable_eventId_status_idx` ON `EventTable`(`eventId`, `status`);

CREATE UNIQUE INDEX `EventTableSeat_tableId_seatNumber_key` ON `EventTableSeat`(`tableId`, `seatNumber`);
CREATE INDEX `EventTableSeat_eventId_tableId_idx` ON `EventTableSeat`(`eventId`, `tableId`);
CREATE INDEX `EventTableSeat_eventId_status_idx` ON `EventTableSeat`(`eventId`, `status`);

CREATE INDEX `EventGuestInvite_eventId_status_idx` ON `EventGuestInvite`(`eventId`, `status`);
CREATE INDEX `EventGuestInvite_tableId_status_idx` ON `EventGuestInvite`(`tableId`, `status`);
CREATE INDEX `EventGuestInvite_seatId_idx` ON `EventGuestInvite`(`seatId`);
CREATE INDEX `EventGuestInvite_tokenHash_idx` ON `EventGuestInvite`(`tokenHash`);

CREATE INDEX `EventTableAccessToken_eventId_tableId_status_idx` ON `EventTableAccessToken`(`eventId`, `tableId`, `status`);
CREATE INDEX `EventTableAccessToken_tokenHash_idx` ON `EventTableAccessToken`(`tokenHash`);
CREATE INDEX `EventTableAccessToken_hostEmail_idx` ON `EventTableAccessToken`(`hostEmail`);

CREATE INDEX `EventCheckInRecord_eventId_checkedInAt_idx` ON `EventCheckInRecord`(`eventId`, `checkedInAt`);
CREATE INDEX `EventCheckInRecord_eventId_status_idx` ON `EventCheckInRecord`(`eventId`, `status`);
CREATE INDEX `EventCheckInRecord_eventId_guestId_idx` ON `EventCheckInRecord`(`eventId`, `guestId`);
CREATE INDEX `EventCheckInRecord_eventId_tableId_idx` ON `EventCheckInRecord`(`eventId`, `tableId`);

CREATE INDEX `EventCheckInException_eventId_status_idx` ON `EventCheckInException`(`eventId`, `status`);
CREATE INDEX `EventCheckInException_eventId_issueType_idx` ON `EventCheckInException`(`eventId`, `issueType`);
CREATE INDEX `EventCheckInException_eventId_createdAt_idx` ON `EventCheckInException`(`eventId`, `createdAt`);

CREATE INDEX `EventEmailLog_eventId_type_status_idx` ON `EventEmailLog`(`eventId`, `type`, `status`);
CREATE INDEX `EventEmailLog_tableId_idx` ON `EventEmailLog`(`tableId`);
CREATE INDEX `EventEmailLog_guestId_idx` ON `EventEmailLog`(`guestId`);
CREATE INDEX `EventEmailLog_inviteId_idx` ON `EventEmailLog`(`inviteId`);
CREATE INDEX `EventEmailLog_recipientEmail_idx` ON `EventEmailLog`(`recipientEmail`);

-- Foreign keys
ALTER TABLE `EventGuest`
  ADD CONSTRAINT `EventGuest_seatId_fkey` FOREIGN KEY (`seatId`) REFERENCES `EventTableSeat`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `EventTableSeat`
  ADD CONSTRAINT `EventTableSeat_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `EventTableSeat_tableId_fkey` FOREIGN KEY (`tableId`) REFERENCES `EventTable`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `EventGuestInvite`
  ADD CONSTRAINT `EventGuestInvite_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `EventGuestInvite_tableId_fkey` FOREIGN KEY (`tableId`) REFERENCES `EventTable`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `EventGuestInvite_seatId_fkey` FOREIGN KEY (`seatId`) REFERENCES `EventTableSeat`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `EventGuestInvite_guestId_fkey` FOREIGN KEY (`guestId`) REFERENCES `EventGuest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `EventGuestInvite_invitedByUserId_fkey` FOREIGN KEY (`invitedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `EventTableAccessToken`
  ADD CONSTRAINT `EventTableAccessToken_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `EventTableAccessToken_tableId_fkey` FOREIGN KEY (`tableId`) REFERENCES `EventTable`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `EventCheckInRecord`
  ADD CONSTRAINT `EventCheckInRecord_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `EventCheckInRecord_guestId_fkey` FOREIGN KEY (`guestId`) REFERENCES `EventGuest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `EventCheckInRecord_tableId_fkey` FOREIGN KEY (`tableId`) REFERENCES `EventTable`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `EventCheckInRecord_seatId_fkey` FOREIGN KEY (`seatId`) REFERENCES `EventTableSeat`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `EventCheckInRecord_checkedInByUserId_fkey` FOREIGN KEY (`checkedInByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `EventCheckInRecord_reversedByUserId_fkey` FOREIGN KEY (`reversedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `EventCheckInException`
  ADD CONSTRAINT `EventCheckInException_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `EventCheckInException_guestId_fkey` FOREIGN KEY (`guestId`) REFERENCES `EventGuest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `EventCheckInException_tableId_fkey` FOREIGN KEY (`tableId`) REFERENCES `EventTable`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `EventCheckInException_seatId_fkey` FOREIGN KEY (`seatId`) REFERENCES `EventTableSeat`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `EventCheckInException_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `EventCheckInException_resolvedByUserId_fkey` FOREIGN KEY (`resolvedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `EventEmailLog`
  ADD CONSTRAINT `EventEmailLog_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `EventEmailLog_tableId_fkey` FOREIGN KEY (`tableId`) REFERENCES `EventTable`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `EventEmailLog_guestId_fkey` FOREIGN KEY (`guestId`) REFERENCES `EventGuest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `EventEmailLog_inviteId_fkey` FOREIGN KEY (`inviteId`) REFERENCES `EventGuestInvite`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
