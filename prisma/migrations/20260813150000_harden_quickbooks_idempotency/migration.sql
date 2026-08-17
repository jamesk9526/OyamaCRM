-- Preserve historical queue audit rows while making the live donation link unique.
-- When legacy duplicates exist, retain a synced row first, otherwise the oldest row.
UPDATE `QBSyncQueueItem` AS duplicate_row
JOIN `QBSyncQueueItem` AS keeper
  ON keeper.`organizationId` = duplicate_row.`organizationId`
 AND keeper.`donationId` = duplicate_row.`donationId`
 AND duplicate_row.`donationId` IS NOT NULL
 AND (
   (keeper.`status` = 'SYNCED' AND duplicate_row.`status` <> 'SYNCED')
   OR (
     (keeper.`status` = 'SYNCED') = (duplicate_row.`status` = 'SYNCED')
     AND (
       keeper.`createdAt` < duplicate_row.`createdAt`
       OR (keeper.`createdAt` = duplicate_row.`createdAt` AND keeper.`id` < duplicate_row.`id`)
     )
   )
 )
SET duplicate_row.`donationId` = NULL;

-- Keep (or restore after a partially failed deployment) the donationId index:
-- MySQL requires an index beginning with donationId for the donation foreign key.
SET @qb_donation_index_exists = (
  SELECT COUNT(*)
  FROM `information_schema`.`statistics`
  WHERE `table_schema` = DATABASE()
    AND `table_name` = 'QBSyncQueueItem'
    AND `index_name` = 'QBSyncQueueItem_donationId_idx'
);
SET @qb_create_donation_index_sql = IF(
  @qb_donation_index_exists > 0,
  'SELECT 1',
  'CREATE INDEX `QBSyncQueueItem_donationId_idx` ON `QBSyncQueueItem`(`donationId`)'
);
PREPARE qb_index_statement FROM @qb_create_donation_index_sql;
EXECUTE qb_index_statement;
DEALLOCATE PREPARE qb_index_statement;

-- A failed MySQL migration may have committed this DDL before Prisma recorded success.
SET @qb_unique_index_exists = (
  SELECT COUNT(*)
  FROM `information_schema`.`statistics`
  WHERE `table_schema` = DATABASE()
    AND `table_name` = 'QBSyncQueueItem'
    AND `index_name` = 'QBSyncQueueItem_organizationId_donationId_key'
);
SET @qb_create_unique_index_sql = IF(
  @qb_unique_index_exists > 0,
  'SELECT 1',
  'CREATE UNIQUE INDEX `QBSyncQueueItem_organizationId_donationId_key` ON `QBSyncQueueItem`(`organizationId`, `donationId`)'
);
PREPARE qb_unique_statement FROM @qb_create_unique_index_sql;
EXECUTE qb_unique_statement;
DEALLOCATE PREPARE qb_unique_statement;
