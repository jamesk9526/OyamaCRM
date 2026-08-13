-- Saved audiences can retain constituent membership independently of email readiness.
-- Existing email-only members remain valid and continue to use the same delivery path.
ALTER TABLE `EmailRecipientListMember`
    MODIFY `email` VARCHAR(191) NULL,
    ADD COLUMN `constituentId` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `EmailRecipientListMember_listId_constituentId_key`
    ON `EmailRecipientListMember`(`listId`, `constituentId`);

CREATE INDEX `EmailRecipientListMember_constituentId_idx`
    ON `EmailRecipientListMember`(`constituentId`);
