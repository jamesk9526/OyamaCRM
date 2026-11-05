ALTER TABLE `ChatGptGrant` MODIFY `scopes` TEXT NOT NULL, ADD COLUMN `consentJson` JSON NULL;
ALTER TABLE `Household` ADD COLUMN `organizationId` VARCHAR(191) NULL;
ALTER TABLE `Tag` ADD COLUMN `organizationId` VARCHAR(191) NULL;
ALTER TABLE `Designation` ADD COLUMN `organizationId` VARCHAR(191) NULL;

-- Only unambiguous ownership is backfilled. Shared/orphaned legacy entities stay
-- quarantined (NULL) until an administrator resolves them; never pick a tenant.
UPDATE `Household` h JOIN (
  SELECT id, MIN(org) AS org FROM (
    SELECT householdId AS id, organizationId AS org FROM `Constituent` WHERE householdId IS NOT NULL
    UNION ALL
    SELECT h.id, c.organizationId AS org FROM `Household` h JOIN `Constituent` c ON c.id=h.headConstituentId
  ) links GROUP BY id HAVING COUNT(DISTINCT org) = 1
) owners ON owners.id = h.id SET h.organizationId = owners.org;
UPDATE `Tag` t JOIN (
  SELECT ct.tagId AS id, MIN(c.organizationId) AS org FROM `ConstituentTag` ct
  JOIN `Constituent` c ON c.id = ct.constituentId
  GROUP BY ct.tagId HAVING COUNT(DISTINCT c.organizationId) = 1
) owners ON owners.id = t.id SET t.organizationId = owners.org;
UPDATE `Designation` d JOIN (
  SELECT id, MIN(org) AS org FROM (
    SELECT gift.designationId AS id, c.organizationId AS org FROM `Donation` gift
    JOIN `Constituent` c ON c.id = gift.constituentId WHERE gift.designationId IS NOT NULL
    UNION ALL
    SELECT p.designationId AS id, c.organizationId AS org FROM `Pledge` p
    JOIN `Constituent` c ON c.id = p.constituentId WHERE p.designationId IS NOT NULL
  ) links GROUP BY id HAVING COUNT(DISTINCT org) = 1
) owners ON owners.id = d.id SET d.organizationId = owners.org;
CREATE INDEX `Household_organizationId_idx` ON `Household` (`organizationId`);
CREATE INDEX `Tag_organizationId_idx` ON `Tag` (`organizationId`);
CREATE INDEX `Designation_organizationId_idx` ON `Designation` (`organizationId`);

CREATE TABLE `AiAccessRevision` (
 `id` VARCHAR(191) NOT NULL, `organizationId` VARCHAR(191) NOT NULL,
 `revision` INTEGER NOT NULL, `actorId` VARCHAR(191) NOT NULL, `documentJson` JSON NOT NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY (`id`), UNIQUE INDEX `AiAccessRevision_organizationId_revision_key` (`organizationId`,`revision`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `AiOperation` (
 `id` VARCHAR(191) NOT NULL, `organizationId` VARCHAR(191) NOT NULL, `actorId` VARCHAR(191) NOT NULL,
 `grantId` VARCHAR(191) NOT NULL, `capability` VARCHAR(191) NOT NULL,
 `requestKey` VARCHAR(100) NOT NULL, `fingerprint` VARCHAR(64) NOT NULL,
 `payloadJson` JSON NOT NULL, `previewJson` JSON NOT NULL, `resultJson` JSON NULL,
 `status` VARCHAR(24) NOT NULL DEFAULT 'PENDING', `reviewerId` VARCHAR(191) NULL,
 `reviewedAt` DATETIME(3) NULL, `reviewReason` VARCHAR(500) NULL,
 `expiresAt` DATETIME(3) NOT NULL, `claimedAt` DATETIME(3) NULL, `finishedAt` DATETIME(3) NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
 PRIMARY KEY (`id`), UNIQUE INDEX `AiOperation_organizationId_actorId_requestKey_key` (`organizationId`,`actorId`,`requestKey`),
 INDEX `AiOperation_organizationId_status_createdAt_idx` (`organizationId`,`status`,`createdAt`),
 INDEX `AiOperation_grantId_status_idx` (`grantId`,`status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
