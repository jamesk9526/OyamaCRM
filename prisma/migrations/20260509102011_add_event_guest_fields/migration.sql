/*
  Warnings:

  - A unique constraint covering the columns `[checkinCode]` on the table `EventGuest` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `eventguest` ADD COLUMN `checkinCode` VARCHAR(191) NULL,
    ADD COLUMN `mealPreference` VARCHAR(191) NULL,
    ADD COLUMN `partyName` VARCHAR(191) NULL,
    ADD COLUMN `paymentStatus` ENUM('PAID', 'DUE', 'PENDING_CHECK', 'COMP', 'SPONSORED') NOT NULL DEFAULT 'DUE',
    ADD COLUMN `rsvpStatus` ENUM('PENDING', 'CONFIRMED', 'DECLINED', 'WAITLIST') NOT NULL DEFAULT 'PENDING',
    ADD COLUMN `seatNumber` INTEGER NULL;

-- AlterTable
ALTER TABLE `eventtable` ADD COLUMN `hostName` VARCHAR(191) NULL,
    ADD COLUMN `isSponsored` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `shape` VARCHAR(191) NOT NULL DEFAULT 'round',
    ADD COLUMN `tableNumber` INTEGER NULL,
    ADD COLUMN `xPosition` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `yPosition` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `tickettype` ADD COLUMN `isTable` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `maxPerOrder` INTEGER NULL,
    ADD COLUMN `minPerOrder` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `seatsIncluded` INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE UNIQUE INDEX `EventGuest_checkinCode_key` ON `EventGuest`(`checkinCode`);
