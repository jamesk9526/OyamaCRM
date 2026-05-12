-- Add new steward-path step type for letter/printable generation
ALTER TABLE `StewardPathStep`
  MODIFY `stepType` ENUM(
    'DELAY',
    'CREATE_TASK',
    'GENERATE_LETTER',
    'DRAFT_EMAIL',
    'SEND_EMAIL',
    'MANUAL_ACTION',
    'INTERNAL_NOTE',
    'STATUS_CHANGE',
    'BRANCH_PLACEHOLDER'
  ) NOT NULL;
