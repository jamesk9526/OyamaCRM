-- Add a care-task association without modifying existing charts or client records.
ALTER TABLE `CompassionFollowUp` ADD COLUMN `chartId` VARCHAR(191) NULL;
CREATE INDEX `CompassionFollowUp_organizationId_chartId_idx` ON `CompassionFollowUp` (`organizationId`, `chartId`);
