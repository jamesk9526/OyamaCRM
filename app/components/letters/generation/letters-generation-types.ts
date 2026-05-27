/** Type contracts for the all-in-one OyamaLetters generation workspace. */

export type GenerateAudienceSource = "single" | "multiple" | "saved-list" | "report-result" | "campaign" | "date-range" | "segment";
export type PreviewMode = "html" | "pdf" | "page";
export type RightPanelTab = "merge-fields" | "document-settings" | "pdf-settings" | "validation" | "activity";
export type GenerationStatus = "Draft" | "Ready to Preview" | "Missing Merge Fields" | "Generating PDF" | "Generated" | "Failed" | "Downloaded" | "Printed" | "Saved to Record";

export interface PrintableDocumentType {
  id: string;
  label: string;
  category?: string;
  description: string;
}

export interface LetterTemplateCard {
  id: string;
  name: string;
  category: string;
  status: string;
  description?: string | null;
  updatedAt: string;
  createdBy?: { firstName?: string | null; lastName?: string | null; email?: string | null } | null;
  updatedBy?: { firstName?: string | null; lastName?: string | null; email?: string | null } | null;
  _count?: { generatedLetters?: number };
}

export interface ConstituentLookup {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  donorStatus?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

export interface DonationLookup {
  id: string;
  amount: number | string;
  date: string;
  status: string;
  constituent?: { firstName?: string | null; lastName?: string | null } | null;
  campaign?: { name?: string | null } | null;
  designation?: { name?: string | null } | null;
}

export interface CampaignLookup {
  id: string;
  name: string;
  active?: boolean;
  _count?: { donations?: number };
}

export interface SavedAudienceList {
  id: string;
  name: string;
  description?: string | null;
  recipientsCount: number;
}

export interface SavedAudienceDetail {
  id: string;
  name: string;
  recipients: Array<{ email: string }>;
}

export interface MergeFieldSection {
  key: string;
  label: string;
  sensitive: boolean;
  fields: string[];
}

export interface SinglePreview {
  values: Record<string, string>;
  unsupportedFields: string[];
  missingFields: string[];
  mergedPrintBody: string;
  mergedPrintSubject?: string | null;
}

export interface BatchResult {
  dryRun: boolean;
  templateId: string;
  totalSelected: number;
  eligible: number;
  generatedCount: number;
  generatedIds?: string[];
  skippedCount: number;
  skippedByReason: Record<string, number>;
  skipped: Array<{ constituentId: string; reason: string }>;
  generated: Array<{ id: string; constituentId: string; constituentName: string }>;
  addToPrintQueue: boolean;
}

export interface PdfPreviewState {
  url: string;
  blob: Blob;
  filename: string;
  letterIds: string[];
  generatedAt: string;
}
