ALTER TABLE `CompassionChart` ADD COLUMN `visitId` VARCHAR(191) NULL;
ALTER TABLE `CompassionService` ADD COLUMN `visitId` VARCHAR(191) NULL, ADD COLUMN `sourceKey` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `CompassionService_retry_key` ON `CompassionService` (`organizationId`, `sourceKey`);
ALTER TABLE `CompassionFollowUp` ADD COLUMN `visitId` VARCHAR(191) NULL;
ALTER TABLE `CompassionDocument` ADD COLUMN `formId` VARCHAR(191) NULL, ADD COLUMN `accessScope` VARCHAR(20) NOT NULL DEFAULT 'CLINICAL';
CREATE TABLE `CompassionFormRecord` (
 `id` VARCHAR(191) NOT NULL, `organizationId` VARCHAR(191) NOT NULL, `clientId` VARCHAR(191) NOT NULL,
 `caseId` VARCHAR(191) NULL, `visitId` VARCHAR(191) NULL, `kind` VARCHAR(50) NOT NULL,
 `templateVersion` INTEGER NOT NULL DEFAULT 1, `sourceDigest` VARCHAR(64) NOT NULL,
 `status` VARCHAR(20) NOT NULL DEFAULT 'DRAFT', `version` INTEGER NOT NULL DEFAULT 1,
 `encryptedAnswers` LONGTEXT NOT NULL, `authorId` VARCHAR(191) NOT NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
 PRIMARY KEY (`id`), INDEX `CompassionFormRecord_client_idx` (`organizationId`, `clientId`, `createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `CompassionFormRevision` (
 `id` VARCHAR(191) NOT NULL, `organizationId` VARCHAR(191) NOT NULL, `formId` VARCHAR(191) NOT NULL,
 `version` INTEGER NOT NULL, `encryptedAnswers` LONGTEXT NOT NULL, `actorId` VARCHAR(191) NOT NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`),
 UNIQUE INDEX `CompassionFormRevision_version_key` (`formId`, `version`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `CompassionVisit` (
 `id` VARCHAR(191) NOT NULL, `organizationId` VARCHAR(191) NOT NULL, `clientId` VARCHAR(191) NOT NULL,
 `caseId` VARCHAR(191) NULL, `appointmentId` VARCHAR(191) NULL, `staffId` VARCHAR(191) NULL,
 `recordKey` VARCHAR(191) NOT NULL, `visitDate` DATE NOT NULL, `location` VARCHAR(191) NOT NULL,
 `status` VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS', `authorId` VARCHAR(191) NOT NULL,
 `encryptedFacts` LONGTEXT NOT NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
 PRIMARY KEY (`id`), UNIQUE INDEX `CompassionVisit_appointment_key` (`appointmentId`),
 UNIQUE INDEX `CompassionVisit_retry_key` (`organizationId`, `recordKey`),
 INDEX `CompassionVisit_register_idx` (`organizationId`, `visitDate`, `location`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `CompassionReportDefinition` (
 `id` VARCHAR(191) NOT NULL, `organizationId` VARCHAR(191) NOT NULL, `version` INTEGER NOT NULL,
 `config` JSON NOT NULL, `authorId` VARCHAR(191) NOT NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`),
 UNIQUE INDEX `CompassionReportDefinition_version_key` (`organizationId`, `version`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
