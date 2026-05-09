-- CreateTable
CREATE TABLE `Organization` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrganizationSettings` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `fiscalYearStart` INTEGER NOT NULL DEFAULT 1,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'America/Chicago',
    `smtpHost` VARCHAR(191) NULL,
    `smtpPort` INTEGER NULL,
    `smtpSecure` BOOLEAN NOT NULL DEFAULT true,
    `smtpUser` VARCHAR(191) NULL,
    `smtpPass` VARCHAR(191) NULL,
    `smtpFromName` VARCHAR(191) NULL,
    `smtpFromEmail` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `OrganizationSettings_organizationId_key`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'staff',
    `avatarUrl` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `passwordHash` VARCHAR(191) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Constituent` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `type` ENUM('DONOR', 'HOUSEHOLD', 'VOLUNTEER', 'MEMBER', 'PROSPECT', 'SPONSOR', 'BOARD_MEMBER', 'FOUNDATION', 'ORGANIZATION') NOT NULL DEFAULT 'DONOR',
    `donorStatus` ENUM('NEW', 'ACTIVE', 'LAPSED', 'MAJOR_DONOR', 'DECEASED') NOT NULL DEFAULT 'NEW',
    `prefix` VARCHAR(191) NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `email2` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `phone2` VARCHAR(191) NULL,
    `mobile` VARCHAR(191) NULL,
    `addressLine1` VARCHAR(191) NULL,
    `addressLine2` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `state` VARCHAR(191) NULL,
    `zip` VARCHAR(191) NULL,
    `country` VARCHAR(191) NOT NULL DEFAULT 'US',
    `birthDate` DATETIME(3) NULL,
    `employer` VARCHAR(191) NULL,
    `occupation` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `avatarUrl` VARCHAR(191) NULL,
    `externalId` VARCHAR(100) NULL,
    `householdId` VARCHAR(191) NULL,
    `isPrimaryContact` BOOLEAN NOT NULL DEFAULT true,
    `doNotEmail` BOOLEAN NOT NULL DEFAULT false,
    `doNotCall` BOOLEAN NOT NULL DEFAULT false,
    `doNotMail` BOOLEAN NOT NULL DEFAULT false,
    `doNotContact` BOOLEAN NOT NULL DEFAULT false,
    `emailOptOut` BOOLEAN NOT NULL DEFAULT false,
    `totalLifetimeGiving` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `totalYtdGiving` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `firstGiftDate` DATETIME(3) NULL,
    `lastGiftDate` DATETIME(3) NULL,
    `lastGiftAmount` DECIMAL(10, 2) NULL,
    `giftCount` INTEGER NOT NULL DEFAULT 0,
    `engagementScore` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Household` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `headConstituentId` VARCHAR(191) NULL,
    `addressLine1` VARCHAR(191) NULL,
    `addressLine2` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `state` VARCHAR(191) NULL,
    `zip` VARCHAR(191) NULL,
    `country` VARCHAR(191) NOT NULL DEFAULT 'US',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Household_headConstituentId_key`(`headConstituentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tag` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NOT NULL DEFAULT '#16a34a',
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConstituentTag` (
    `constituentId` VARCHAR(191) NOT NULL,
    `tagId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`constituentId`, `tagId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Donation` (
    `id` VARCHAR(191) NOT NULL,
    `constituentId` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NULL,
    `designationId` VARCHAR(191) NULL,
    `pledgeId` VARCHAR(191) NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `feeAmount` DECIMAL(8, 2) NOT NULL DEFAULT 0,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `paymentMethod` ENUM('CREDIT_CARD', 'ACH', 'CHECK', 'WIRE', 'STOCK', 'IN_KIND', 'CASH', 'ONLINE') NOT NULL DEFAULT 'ONLINE',
    `status` ENUM('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'COMPLETED',
    `checkNumber` VARCHAR(191) NULL,
    `transactionId` VARCHAR(191) NULL,
    `isRecurring` BOOLEAN NOT NULL DEFAULT false,
    `frequency` ENUM('WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY') NULL,
    `nextGiftDate` DATETIME(3) NULL,
    `receiptNumber` VARCHAR(191) NULL,
    `receiptSentAt` DATETIME(3) NULL,
    `acknowledgmentSentAt` DATETIME(3) NULL,
    `taxDeductible` BOOLEAN NOT NULL DEFAULT true,
    `inKindDescription` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Donation_receiptNumber_key`(`receiptNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Pledge` (
    `id` VARCHAR(191) NOT NULL,
    `constituentId` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NULL,
    `designationId` VARCHAR(191) NULL,
    `totalAmount` DECIMAL(10, 2) NOT NULL,
    `paidAmount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NULL,
    `frequency` ENUM('WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY') NULL,
    `notes` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Designation` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Campaign` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `category` ENUM('ANNUAL_FUND', 'CAPITAL', 'ENDOWMENT', 'EVENT', 'GIVING_DAY', 'MAJOR_GIFTS', 'PLANNED_GIVING', 'GENERAL') NOT NULL DEFAULT 'ANNUAL_FUND',
    `goal` DECIMAL(12, 2) NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Task` (
    `id` VARCHAR(191) NOT NULL,
    `constituentId` VARCHAR(191) NULL,
    `assigneeId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `type` ENUM('CALL', 'EMAIL', 'MAIL', 'MEETING', 'THANK_YOU', 'FOLLOW_UP', 'OTHER') NOT NULL DEFAULT 'FOLLOW_UP',
    `status` ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
    `dueDate` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Event` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `type` ENUM('GALA', 'AUCTION', 'RUN_WALK', 'CONFERENCE', 'WORKSHOP', 'CULTIVATION', 'STEWARDSHIP', 'VOLUNTEER', 'ONLINE', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `location` VARCHAR(191) NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NULL,
    `registrationGoal` INTEGER NULL,
    `revenueGoal` DECIMAL(10, 2) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EventAttendance` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `constituentId` VARCHAR(191) NOT NULL,
    `checkedIn` BOOLEAN NOT NULL DEFAULT false,
    `checkedInAt` DATETIME(3) NULL,
    `ticketType` VARCHAR(191) NULL,
    `amountPaid` DECIMAL(8, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VolunteerHour` (
    `id` VARCHAR(191) NOT NULL,
    `constituentId` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NULL,
    `hours` DECIMAL(6, 2) NOT NULL,
    `description` VARCHAR(191) NULL,
    `date` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Activity` (
    `id` VARCHAR(191) NOT NULL,
    `constituentId` VARCHAR(191) NULL,
    `donationId` VARCHAR(191) NULL,
    `taskId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NULL,
    `type` ENUM('DONATION', 'TASK_COMPLETED', 'EMAIL_SENT', 'EMAIL_RECEIVED', 'CALL', 'MEETING', 'NOTE', 'EVENT_ATTENDANCE', 'VOLUNTEER_HOURS', 'PLEDGE_MADE') NOT NULL,
    `description` TEXT NOT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RefreshToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(512) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `RefreshToken_token_key`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entity` VARCHAR(191) NULL,
    `entityId` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Automation` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `trigger` ENUM('DONATION_RECEIVED', 'CONSTITUENT_CREATED', 'TASK_DUE', 'PLEDGE_CREATED', 'EMAIL_OPENED', 'EVENT_REGISTERED') NOT NULL,
    `triggerConfig` JSON NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `runCount` INTEGER NOT NULL DEFAULT 0,
    `lastRunAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AutomationAction` (
    `id` VARCHAR(191) NOT NULL,
    `automationId` VARCHAR(191) NOT NULL,
    `type` ENUM('SEND_EMAIL', 'CREATE_TASK', 'UPDATE_FIELD', 'ADD_TAG', 'REMOVE_TAG', 'ASSIGN_USER') NOT NULL,
    `config` JSON NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailCampaign` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `previewText` VARCHAR(191) NULL,
    `fromName` VARCHAR(191) NOT NULL DEFAULT 'OyamaCRM',
    `fromEmail` VARCHAR(191) NOT NULL DEFAULT 'noreply@oyamacrm.org',
    `replyToEmail` VARCHAR(191) NULL,
    `bodyHtml` LONGTEXT NULL,
    `bodyText` TEXT NULL,
    `templateJson` LONGTEXT NULL,
    `status` ENUM('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `scheduledAt` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NULL,
    `audienceFilter` TEXT NULL,
    `totalRecipients` INTEGER NOT NULL DEFAULT 0,
    `delivered` INTEGER NOT NULL DEFAULT 0,
    `opened` INTEGER NOT NULL DEFAULT 0,
    `clicked` INTEGER NOT NULL DEFAULT 0,
    `bounced` INTEGER NOT NULL DEFAULT 0,
    `unsubscribed` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `OrganizationSettings` ADD CONSTRAINT `OrganizationSettings_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Constituent` ADD CONSTRAINT `Constituent_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Constituent` ADD CONSTRAINT `Constituent_householdId_fkey` FOREIGN KEY (`householdId`) REFERENCES `Household`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Household` ADD CONSTRAINT `Household_headConstituentId_fkey` FOREIGN KEY (`headConstituentId`) REFERENCES `Constituent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConstituentTag` ADD CONSTRAINT `ConstituentTag_constituentId_fkey` FOREIGN KEY (`constituentId`) REFERENCES `Constituent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConstituentTag` ADD CONSTRAINT `ConstituentTag_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `Tag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Donation` ADD CONSTRAINT `Donation_constituentId_fkey` FOREIGN KEY (`constituentId`) REFERENCES `Constituent`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Donation` ADD CONSTRAINT `Donation_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Donation` ADD CONSTRAINT `Donation_designationId_fkey` FOREIGN KEY (`designationId`) REFERENCES `Designation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Donation` ADD CONSTRAINT `Donation_pledgeId_fkey` FOREIGN KEY (`pledgeId`) REFERENCES `Pledge`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pledge` ADD CONSTRAINT `Pledge_constituentId_fkey` FOREIGN KEY (`constituentId`) REFERENCES `Constituent`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pledge` ADD CONSTRAINT `Pledge_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pledge` ADD CONSTRAINT `Pledge_designationId_fkey` FOREIGN KEY (`designationId`) REFERENCES `Designation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Campaign` ADD CONSTRAINT `Campaign_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_constituentId_fkey` FOREIGN KEY (`constituentId`) REFERENCES `Constituent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Event` ADD CONSTRAINT `Event_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventAttendance` ADD CONSTRAINT `EventAttendance_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventAttendance` ADD CONSTRAINT `EventAttendance_constituentId_fkey` FOREIGN KEY (`constituentId`) REFERENCES `Constituent`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerHour` ADD CONSTRAINT `VolunteerHour_constituentId_fkey` FOREIGN KEY (`constituentId`) REFERENCES `Constituent`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerHour` ADD CONSTRAINT `VolunteerHour_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Activity` ADD CONSTRAINT `Activity_constituentId_fkey` FOREIGN KEY (`constituentId`) REFERENCES `Constituent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Activity` ADD CONSTRAINT `Activity_donationId_fkey` FOREIGN KEY (`donationId`) REFERENCES `Donation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Activity` ADD CONSTRAINT `Activity_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Activity` ADD CONSTRAINT `Activity_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefreshToken` ADD CONSTRAINT `RefreshToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AutomationAction` ADD CONSTRAINT `AutomationAction_automationId_fkey` FOREIGN KEY (`automationId`) REFERENCES `Automation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailCampaign` ADD CONSTRAINT `EmailCampaign_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
