ALTER TABLE `OrganizationSettings` ADD COLUMN `oyamaCreateClassicLettersEnabled` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `LetterTemplate` ADD COLUMN `createContentId` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `LetterTemplate_createContentId_key` ON `LetterTemplate`(`createContentId`);
ALTER TABLE `CreateVariant` ADD COLUMN `letterAdaptationJson` JSON NULL;
