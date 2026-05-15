/** Shared type contracts for the letters generation wizard flow. */

export type LettersGenerateStep = "template" | "recipients" | "preview" | "complete";

export type LettersProjectType = "INDIVIDUAL" | "BATCH";

export type LettersRouteTarget = "PRINT_QUEUE" | "MAIL_QUEUE" | "EMAIL_DRAFT";

export type LettersBatchFilterType = "ALL" | "ACTIVE" | "LAPSED" | "NEW" | "MAJOR_DONOR" | "MONTHLY_DONOR";

export interface LettersWizardState {
  projectType: LettersProjectType;
  templateId: string;
  constituentId: string;
  donationId: string;
  campaignId: string;
  eventId: string;
  year: string;
  batchFilterType: LettersBatchFilterType;
  batchConstituentIdsText: string;
  dedupeHousehold: boolean;
  routeTarget: LettersRouteTarget;
  previewConfirmedAt: string | null;
}

export interface LettersConstituentLookup {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  donorStatus?: string | null;
}

export interface LettersTemplateDetails {
  id: string;
  name: string;
  category: string;
  description?: string | null;
  headerPreset?: { id: string; name: string } | null;
  footerPreset?: { id: string; name: string } | null;
  signatureBlock?: { id: string; name: string; signerName: string } | null;
}

export interface LettersSinglePreview {
  mergedPrintBody: string;
  unsupportedFields: string[];
}

export interface LettersBatchPreviewResult {
  dryRun: boolean;
  templateId: string;
  totalSelected: number;
  eligible: number;
  generatedCount: number;
  skippedCount: number;
  skippedByReason: Record<string, number>;
  skipped: Array<{ constituentId: string; reason: string }>;
  generated: Array<{ id: string; constituentId: string; constituentName: string }>;
  addToPrintQueue: boolean;
}
