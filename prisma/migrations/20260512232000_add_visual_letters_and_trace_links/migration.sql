-- Add letters visual builder feature flag to organization settings
ALTER TABLE `OrganizationSettings`
  ADD COLUMN `lettersVisualBuilderEnabled` BOOLEAN NOT NULL DEFAULT false;

-- Add optional visual layout storage to letter templates
ALTER TABLE `LetterTemplate`
  ADD COLUMN `printLayoutJson` JSON NULL;

-- Add cross-link trace fields to generated letters
ALTER TABLE `GeneratedLetter`
  ADD COLUMN `sourceTaskId` VARCHAR(191) NULL,
  ADD COLUMN `stewardPathEnrollmentId` VARCHAR(191) NULL,
  ADD COLUMN `stewardPathStepRunId` VARCHAR(191) NULL;

CREATE INDEX `GeneratedLetter_sourceTaskId_idx` ON `GeneratedLetter`(`sourceTaskId`);
CREATE INDEX `GeneratedLetter_stewardPathEnrollmentId_idx` ON `GeneratedLetter`(`stewardPathEnrollmentId`);
CREATE INDEX `GeneratedLetter_stewardPathStepRunId_idx` ON `GeneratedLetter`(`stewardPathStepRunId`);

-- Add cross-link trace fields to tasks
ALTER TABLE `Task`
  ADD COLUMN `generatedLetterId` VARCHAR(191) NULL,
  ADD COLUMN `stewardPathEnrollmentId` VARCHAR(191) NULL,
  ADD COLUMN `stewardPathStepRunId` VARCHAR(191) NULL;

CREATE INDEX `Task_generatedLetterId_idx` ON `Task`(`generatedLetterId`);
CREATE INDEX `Task_stewardPathEnrollmentId_idx` ON `Task`(`stewardPathEnrollmentId`);
CREATE INDEX `Task_stewardPathStepRunId_idx` ON `Task`(`stewardPathStepRunId`);
