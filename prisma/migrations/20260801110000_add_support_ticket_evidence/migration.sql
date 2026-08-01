ALTER TABLE `WatchdogFeedbackTicket`
  ADD COLUMN `supportSummary` VARCHAR(300) NULL,
  ADD COLUMN `screenshotDataUrl` LONGTEXT NULL,
  ADD COLUMN `screenshotCapturedAt` DATETIME(3) NULL,
  ADD COLUMN `supportEmailRecipient` VARCHAR(320) NULL,
  ADD COLUMN `supportEmailStatus` VARCHAR(30) NOT NULL DEFAULT 'not_configured',
  ADD COLUMN `supportEmailError` LONGTEXT NULL;