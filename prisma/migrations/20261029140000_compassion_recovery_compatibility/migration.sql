-- Compatibility with installations that retain only the original Compassion migration.

SET @care_column_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND LOWER(table_name) = 'compassionclient' AND column_name = 'assignedCompassionStaffId');
SET @care_ddl = IF(@care_column_exists = 0, 'ALTER TABLE `CompassionClient` ADD COLUMN `assignedCompassionStaffId` VARCHAR(191) NULL', 'SELECT 1');
PREPARE care_stmt FROM @care_ddl;
EXECUTE care_stmt;
DEALLOCATE PREPARE care_stmt;

SET @care_column_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND LOWER(table_name) = 'compassioncase' AND column_name = 'assignedCompassionStaffId');
SET @care_ddl = IF(@care_column_exists = 0, 'ALTER TABLE `CompassionCase` ADD COLUMN `assignedCompassionStaffId` VARCHAR(191) NULL', 'SELECT 1');
PREPARE care_stmt FROM @care_ddl;
EXECUTE care_stmt;
DEALLOCATE PREPARE care_stmt;

SET @care_column_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND LOWER(table_name) = 'compassionappointment' AND column_name = 'assignedCompassionStaffId');
SET @care_ddl = IF(@care_column_exists = 0, 'ALTER TABLE `CompassionAppointment` ADD COLUMN `assignedCompassionStaffId` VARCHAR(191) NULL', 'SELECT 1');
PREPARE care_stmt FROM @care_ddl;
EXECUTE care_stmt;
DEALLOCATE PREPARE care_stmt;

SET @care_column_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND LOWER(table_name) = 'compassionfollowup' AND column_name = 'assignedCompassionStaffId');
SET @care_ddl = IF(@care_column_exists = 0, 'ALTER TABLE `CompassionFollowUp` ADD COLUMN `assignedCompassionStaffId` VARCHAR(191) NULL', 'SELECT 1');
PREPARE care_stmt FROM @care_ddl;
EXECUTE care_stmt;
DEALLOCATE PREPARE care_stmt;

SET @care_column_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND LOWER(table_name) = 'compassionservice' AND column_name = 'providedByCompassionStaffId');
SET @care_ddl = IF(@care_column_exists = 0, 'ALTER TABLE `CompassionService` ADD COLUMN `providedByCompassionStaffId` VARCHAR(191) NULL', 'SELECT 1');
PREPARE care_stmt FROM @care_ddl;
EXECUTE care_stmt;
DEALLOCATE PREPARE care_stmt;

SET @care_column_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND LOWER(table_name) = 'compassionactivity' AND column_name = 'performedByCompassionStaffId');
SET @care_ddl = IF(@care_column_exists = 0, 'ALTER TABLE `CompassionActivity` ADD COLUMN `performedByCompassionStaffId` VARCHAR(191) NULL', 'SELECT 1');
PREPARE care_stmt FROM @care_ddl;
EXECUTE care_stmt;
DEALLOCATE PREPARE care_stmt;
