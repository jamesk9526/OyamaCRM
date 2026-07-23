-- Configure the right side of production letter headers independently of the logo.
ALTER TABLE `LetterHeaderPreset`
  ADD COLUMN `rightColumnMode` VARCHAR(24) NOT NULL DEFAULT 'ORGANIZATION',
  ADD COLUMN `rightColumnHtml` LONGTEXT NULL;
