-- Permanently remove the retired OyamaHRM module and its data.
-- This is intentionally a forward-only destructive migration.

DELETE FROM `StewardPath` WHERE `crmScope` = 'HRM';

ALTER TABLE `StewardPath`
  MODIFY `crmScope` ENUM('DONOR', 'EVENTS', 'GLOBAL') NOT NULL DEFAULT 'DONOR';

DROP TABLE IF EXISTS `HrmSetting`;
DROP TABLE IF EXISTS `HrmMessage`;
DROP TABLE IF EXISTS `HrmLocation`;
