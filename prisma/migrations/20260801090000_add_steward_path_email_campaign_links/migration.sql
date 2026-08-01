ALTER TABLE `StewardPathEmailDraft`
  ADD COLUMN `sourceCampaignId` VARCHAR(191) NULL,
  ADD COLUMN `deliveryCampaignId` VARCHAR(191) NULL;

CREATE INDEX `StewardPathEmailDraft_sourceCampaignId_idx`
  ON `StewardPathEmailDraft`(`sourceCampaignId`);

CREATE INDEX `StewardPathEmailDraft_deliveryCampaignId_idx`
  ON `StewardPathEmailDraft`(`deliveryCampaignId`);