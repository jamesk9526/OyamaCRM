-- Compassion-only additive recovery. No donor table is altered.
CREATE TABLE IF NOT EXISTS `CompassionStaff` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `linkedUserId` VARCHAR(191) NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NULL,
    `title` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `supportsScheduling` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CompassionStaff_linkedUserId_key`(`linkedUserId`),
    INDEX `CompassionStaff_organizationId_isActive_idx`(`organizationId`, `isActive`),
    UNIQUE INDEX `CompassionStaff_organizationId_email_key`(`organizationId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CompassionClient` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `constituentId` VARCHAR(191) NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `preferredName` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `addressLine1` VARCHAR(191) NULL,
    `addressLine2` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `state` VARCHAR(191) NULL,
    `zip` VARCHAR(191) NULL,
    `dateOfBirth` DATETIME(3) NULL,
    `sourceSystem` VARCHAR(60) NULL,
    `externalSourceId` VARCHAR(191) NULL,
    `safeContact` JSON NULL,
    `clientStatus` ENUM('ACTIVE', 'INACTIVE', 'GRADUATED', 'ARCHIVED', 'PENDING') NOT NULL DEFAULT 'ACTIVE',
    `assignedStaffId` VARCHAR(191) NULL,
    `assignedCompassionStaffId` VARCHAR(191) NULL,
    `intakeDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `referralSource` VARCHAR(191) NULL,
    `privateNotes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CompassionClient_organizationId_idx`(`organizationId`),
    UNIQUE INDEX `CompassionClient_organizationId_sourceSystem_externalSourceI_key`(`organizationId`, `sourceSystem`, `externalSourceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CompassionCase` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `caseNumber` VARCHAR(191) NOT NULL,
    `caseStatus` ENUM('OPEN', 'IN_PROGRESS', 'PENDING', 'CLOSED', 'ARCHIVED') NOT NULL DEFAULT 'OPEN',
    `caseType` ENUM('PREGNANCY_SUPPORT', 'PARENTING', 'MATERIAL_ASSISTANCE', 'HOUSING', 'EDUCATION', 'EMPLOYMENT', 'COUNSELING', 'RESOURCE_REFERRAL', 'FOLLOW_UP', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `openedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `closedAt` DATETIME(3) NULL,
    `assignedStaffId` VARCHAR(191) NULL,
    `assignedCompassionStaffId` VARCHAR(191) NULL,
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
    `summary` TEXT NULL,
    `privateNotes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CompassionCase_caseNumber_key`(`caseNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CompassionAppointment` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NULL,
    `appointmentType` ENUM('INTAKE', 'PREGNANCY_TEST', 'ULTRASOUND', 'PARENTING_CLASS', 'MATERIAL_ASSISTANCE', 'RESOURCE_REFERRAL', 'FOLLOW_UP', 'MENTORING', 'CASE_REVIEW', 'HOME_VISIT', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `status` ENUM('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED') NOT NULL DEFAULT 'SCHEDULED',
    `startTime` DATETIME(3) NOT NULL,
    `endTime` DATETIME(3) NULL,
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'America/Chicago',
    `location` VARCHAR(191) NULL,
    `assignedStaffId` VARCHAR(191) NULL,
    `assignedCompassionStaffId` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `outcome` TEXT NULL,
    `followUpNeeded` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CompassionService` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NULL,
    `serviceType` ENUM('PREGNANCY_TEST', 'ULTRASOUND', 'DIAPERS', 'CLOTHING', 'FORMULA', 'PARENTING_CLASS', 'HOUSING_REFERRAL', 'EDUCATION_REFERRAL', 'JOB_REFERRAL', 'NUTRITION_SUPPORT', 'COUNSELING', 'TRANSPORTATION_RESOURCE', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `serviceDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `quantity` INTEGER NULL,
    `notes` TEXT NULL,
    `providedById` VARCHAR(191) NULL,
    `providedByCompassionStaffId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CompassionFollowUp` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NULL,
    `appointmentId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `dueDate` DATETIME(3) NOT NULL,
    `status` ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'OVERDUE') NOT NULL DEFAULT 'PENDING',
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
    `assignedStaffId` VARCHAR(191) NULL,
    `assignedCompassionStaffId` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CompassionActivity` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NULL,
    `appointmentId` VARCHAR(191) NULL,
    `activityType` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `performedById` VARCHAR(191) NULL,
    `performedByCompassionStaffId` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CompassionMembership` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `role` VARCHAR(30) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CompassionMembership_organizationId_userId_key`(`organizationId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CompassionAudit` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `action` VARCHAR(100) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CompassionAudit_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CompassionScheduleLock` (
    `organizationId` VARCHAR(191) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`organizationId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CompassionResource` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(30) NOT NULL,
    `location` VARCHAR(191) NULL,
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'America/Chicago',
    `availability` JSON NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    INDEX `CompassionResource_organizationId_active_idx`(`organizationId`, `active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CompassionReservation` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `appointmentId` VARCHAR(191) NOT NULL,
    `resourceId` VARCHAR(191) NOT NULL,
    `startTime` DATETIME(3) NOT NULL,
    `endTime` DATETIME(3) NOT NULL,

    INDEX `CompassionReservation_organizationId_resourceId_startTime_idx`(`organizationId`, `resourceId`, `startTime`),
    UNIQUE INDEX `CompassionReservation_appointmentId_resourceId_key`(`appointmentId`, `resourceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CompassionChart` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NULL,
    `kind` VARCHAR(50) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `templateVersion` INTEGER NOT NULL DEFAULT 1,
    `status` VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    `encryptedContent` LONGTEXT NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `previousId` VARCHAR(191) NULL,
    `signedById` VARCHAR(191) NULL,
    `signedAt` DATETIME(3) NULL,
    `signatureDigest` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CompassionChart_organizationId_clientId_createdAt_idx`(`organizationId`, `clientId`, `createdAt`),
    INDEX `CompassionChart_organizationId_status_idx`(`organizationId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CompassionDocument` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `chartId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(100) NOT NULL,
    `checksum` VARCHAR(64) NOT NULL,
    `encryptedContent` LONGTEXT NOT NULL,
    `size` INTEGER NOT NULL,
    `uploadedById` VARCHAR(191) NOT NULL,
    `historical` BOOLEAN NOT NULL DEFAULT false,
    `shared` BOOLEAN NOT NULL DEFAULT false,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CompassionDocument_organizationId_clientId_idx`(`organizationId`, `clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CompassionImportBatch` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NOT NULL,
    `sourceSystem` VARCHAR(191) NOT NULL DEFAULT 'centerpiece',
    `checksum` VARCHAR(64) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PREVIEW',
    `encryptedPayload` LONGTEXT NOT NULL,
    `result` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `committedAt` DATETIME(3) NULL,

    INDEX `CompassionImportBatch_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CompassionIntake` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `appointmentId` VARCHAR(191) NULL,
    `tokenHash` VARCHAR(64) NOT NULL,
    `language` VARCHAR(5) NOT NULL DEFAULT 'en',
    `status` VARCHAR(20) NOT NULL DEFAULT 'REQUESTED',
    `template` JSON NOT NULL,
    `encryptedSubmission` LONGTEXT NULL,
    `consentVersion` VARCHAR(191) NOT NULL,
    `signedName` VARCHAR(191) NULL,
    `signedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processedAt` DATETIME(3) NULL,

    UNIQUE INDEX `CompassionIntake_tokenHash_key`(`tokenHash`),
    INDEX `CompassionIntake_organizationId_clientId_idx`(`organizationId`, `clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CompassionPortalAccess` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CompassionPortalAccess_tokenHash_key`(`tokenHash`),
    INDEX `CompassionPortalAccess_organizationId_clientId_idx`(`organizationId`, `clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CompassionMessage` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `direction` VARCHAR(15) NOT NULL,
    `encryptedContent` LONGTEXT NOT NULL,
    `authorId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CompassionMessage_organizationId_clientId_createdAt_idx`(`organizationId`, `clientId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CompassionClass` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `startTime` DATETIME(3) NOT NULL,
    `capacity` INTEGER NOT NULL DEFAULT 20,
    `points` INTEGER NOT NULL DEFAULT 0,
    `location` VARCHAR(191) NULL,
    `staffId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CompassionClass_organizationId_startTime_idx`(`organizationId`, `startTime`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CompassionEnrollment` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `classId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'ENROLLED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CompassionEnrollment_organizationId_clientId_idx`(`organizationId`, `clientId`),
    UNIQUE INDEX `CompassionEnrollment_classId_clientId_key`(`classId`, `clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CompassionPointEntry` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `amount` INTEGER NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `sourceKey` VARCHAR(191) NULL,
    `actorId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CompassionPointEntry_sourceKey_key`(`sourceKey`),
    INDEX `CompassionPointEntry_organizationId_clientId_idx`(`organizationId`, `clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CompassionStaffHours` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `staffId` VARCHAR(191) NOT NULL,
    `serviceArea` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `minutes` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CompassionStaffHours_organizationId_staffId_idx`(`organizationId`, `staffId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @care_column_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND LOWER(table_name) = 'compassionclient' AND column_name = 'sourceSystem');
SET @care_ddl = IF(@care_column_exists = 0, 'ALTER TABLE `CompassionClient` ADD COLUMN `sourceSystem` VARCHAR(60) NULL', 'SELECT 1');
PREPARE care_stmt FROM @care_ddl;
EXECUTE care_stmt;
DEALLOCATE PREPARE care_stmt;

SET @care_column_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND LOWER(table_name) = 'compassionclient' AND column_name = 'externalSourceId');
SET @care_ddl = IF(@care_column_exists = 0, 'ALTER TABLE `CompassionClient` ADD COLUMN `externalSourceId` VARCHAR(191) NULL', 'SELECT 1');
PREPARE care_stmt FROM @care_ddl;
EXECUTE care_stmt;
DEALLOCATE PREPARE care_stmt;

SET @care_column_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND LOWER(table_name) = 'compassionclient' AND column_name = 'safeContact');
SET @care_ddl = IF(@care_column_exists = 0, 'ALTER TABLE `CompassionClient` ADD COLUMN `safeContact` JSON NULL', 'SELECT 1');
PREPARE care_stmt FROM @care_ddl;
EXECUTE care_stmt;
DEALLOCATE PREPARE care_stmt;

SET @care_index_exists = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND LOWER(table_name) = 'compassionclient' AND index_name = 'CompassionClient_source_key');
SET @care_ddl = IF(@care_index_exists = 0, 'CREATE UNIQUE INDEX `CompassionClient_source_key` ON `CompassionClient` (`organizationId`, `sourceSystem`, `externalSourceId`)', 'SELECT 1');
PREPARE care_stmt FROM @care_ddl;
EXECUTE care_stmt;
DEALLOCATE PREPARE care_stmt;
