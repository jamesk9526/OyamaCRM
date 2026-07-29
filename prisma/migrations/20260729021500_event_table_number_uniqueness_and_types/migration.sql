-- Expand EventSTUDIO beyond gala-only language so table-based fundraisers and
-- trivia nights can be represented directly.
ALTER TABLE `Event`
  MODIFY `type` ENUM(
    'GALA',
    'TRIVIA',
    'FUNDRAISER',
    'AUCTION',
    'RUN_WALK',
    'CONFERENCE',
    'WORKSHOP',
    'CULTIVATION',
    'STEWARDSHIP',
    'VOLUNTEER',
    'ONLINE',
    'OTHER'
  ) NOT NULL DEFAULT 'OTHER';

-- Preserve the oldest table assignment and clear duplicate legacy numbers
-- before adding the production uniqueness boundary.
CREATE TEMPORARY TABLE `_EventTableNumberKeepers` AS
SELECT `eventId`, `tableNumber`, MIN(`id`) AS `keepId`
FROM `EventTable`
WHERE `tableNumber` IS NOT NULL
GROUP BY `eventId`, `tableNumber`
HAVING COUNT(*) > 1;

UPDATE `EventTable` AS table_record
INNER JOIN `_EventTableNumberKeepers` AS keeper
  ON keeper.`eventId` = table_record.`eventId`
  AND keeper.`tableNumber` = table_record.`tableNumber`
  AND table_record.`id` <> keeper.`keepId`
SET table_record.`tableNumber` = NULL;

DROP TEMPORARY TABLE `_EventTableNumberKeepers`;

CREATE UNIQUE INDEX `EventTable_eventId_tableNumber_key`
  ON `EventTable`(`eventId`, `tableNumber`);
