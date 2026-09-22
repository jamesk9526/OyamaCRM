ALTER TABLE `Donation`
  ADD COLUMN `taxDeductibleAmount` DECIMAL(10, 2) NULL,
  ADD COLUMN `taxDeductibleNotes` TEXT NULL,
  ADD COLUMN `taxReceiptRequested` BOOLEAN NOT NULL DEFAULT false;

UPDATE `Donation`
SET `taxDeductibleAmount` = CASE
  WHEN `taxDeductible` = true THEN `amount`
  ELSE 0
END;
