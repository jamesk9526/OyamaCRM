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

DROP INDEX `QBSyncQueueItem_donationId_idx` ON `QBSyncQueueItem`;
CREATE UNIQUE INDEX `QBSyncQueueItem_organizationId_donationId_key`
  ON `QBSyncQueueItem`(`organizationId`, `donationId`);
