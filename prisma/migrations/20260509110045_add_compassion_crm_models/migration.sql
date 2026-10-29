-- CreateTable
CREATE TABLE `CompassionClient` (
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
    `clientStatus` ENUM('ACTIVE', 'INACTIVE', 'GRADUATED', 'ARCHIVED', 'PENDING') NOT NULL DEFAULT 'ACTIVE',
    `assignedStaffId` VARCHAR(191) NULL,
    `intakeDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `referralSource` VARCHAR(191) NULL,
    `privateNotes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompassionCase` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `caseNumber` VARCHAR(191) NOT NULL,
    `caseStatus` ENUM('OPEN', 'IN_PROGRESS', 'PENDING', 'CLOSED', 'ARCHIVED') NOT NULL DEFAULT 'OPEN',
    `caseType` ENUM('PREGNANCY_SUPPORT', 'PARENTING', 'MATERIAL_ASSISTANCE', 'HOUSING', 'EDUCATION', 'EMPLOYMENT', 'COUNSELING', 'RESOURCE_REFERRAL', 'FOLLOW_UP', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `openedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `closedAt` DATETIME(3) NULL,
    `assignedStaffId` VARCHAR(191) NULL,
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
    `summary` TEXT NULL,
    `privateNotes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CompassionCase_caseNumber_key`(`caseNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompassionAppointment` (
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
    `notes` TEXT NULL,
    `outcome` TEXT NULL,
    `followUpNeeded` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompassionService` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NULL,
    `serviceType` ENUM('PREGNANCY_TEST', 'ULTRASOUND', 'DIAPERS', 'CLOTHING', 'FORMULA', 'PARENTING_CLASS', 'HOUSING_REFERRAL', 'EDUCATION_REFERRAL', 'JOB_REFERRAL', 'NUTRITION_SUPPORT', 'COUNSELING', 'TRANSPORTATION_RESOURCE', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `serviceDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `quantity` INTEGER NULL,
    `notes` TEXT NULL,
    `providedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompassionFollowUp` (
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
    `notes` TEXT NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompassionActivity` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NULL,
    `appointmentId` VARCHAR(191) NULL,
    `activityType` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `performedById` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CompassionClient` ADD CONSTRAINT `CompassionClient_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompassionClient` ADD CONSTRAINT `CompassionClient_constituentId_fkey` FOREIGN KEY (`constituentId`) REFERENCES `Constituent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompassionClient` ADD CONSTRAINT `CompassionClient_assignedStaffId_fkey` FOREIGN KEY (`assignedStaffId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompassionCase` ADD CONSTRAINT `CompassionCase_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompassionCase` ADD CONSTRAINT `CompassionCase_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `CompassionClient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompassionCase` ADD CONSTRAINT `CompassionCase_assignedStaffId_fkey` FOREIGN KEY (`assignedStaffId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompassionAppointment` ADD CONSTRAINT `CompassionAppointment_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompassionAppointment` ADD CONSTRAINT `CompassionAppointment_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `CompassionClient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompassionAppointment` ADD CONSTRAINT `CompassionAppointment_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `CompassionCase`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompassionAppointment` ADD CONSTRAINT `CompassionAppointment_assignedStaffId_fkey` FOREIGN KEY (`assignedStaffId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompassionService` ADD CONSTRAINT `CompassionService_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompassionService` ADD CONSTRAINT `CompassionService_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `CompassionClient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompassionService` ADD CONSTRAINT `CompassionService_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `CompassionCase`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompassionService` ADD CONSTRAINT `CompassionService_providedById_fkey` FOREIGN KEY (`providedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompassionFollowUp` ADD CONSTRAINT `CompassionFollowUp_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompassionFollowUp` ADD CONSTRAINT `CompassionFollowUp_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `CompassionClient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompassionFollowUp` ADD CONSTRAINT `CompassionFollowUp_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `CompassionCase`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompassionFollowUp` ADD CONSTRAINT `CompassionFollowUp_appointmentId_fkey` FOREIGN KEY (`appointmentId`) REFERENCES `CompassionAppointment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompassionFollowUp` ADD CONSTRAINT `CompassionFollowUp_assignedStaffId_fkey` FOREIGN KEY (`assignedStaffId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompassionActivity` ADD CONSTRAINT `CompassionActivity_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompassionActivity` ADD CONSTRAINT `CompassionActivity_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `CompassionClient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompassionActivity` ADD CONSTRAINT `CompassionActivity_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `CompassionCase`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompassionActivity` ADD CONSTRAINT `CompassionActivity_appointmentId_fkey` FOREIGN KEY (`appointmentId`) REFERENCES `CompassionAppointment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompassionActivity` ADD CONSTRAINT `CompassionActivity_performedById_fkey` FOREIGN KEY (`performedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
