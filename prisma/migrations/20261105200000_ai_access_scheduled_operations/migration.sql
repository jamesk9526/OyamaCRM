ALTER TABLE `AiOperation` ADD COLUMN `runAfter` DATETIME(3) NULL;
CREATE INDEX `AiOperation_status_runAfter_idx` ON `AiOperation` (`status`, `runAfter`);
