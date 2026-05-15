/** Shared type contracts for the Letters & Printables workspace UI. */

export type PrintLayoutKind = "PARAGRAPH" | "HEADING" | "MERGE_TOKEN" | "DIVIDER" | "SPACER";

export interface PrintLayoutBlock {
  id: string;
  kind: PrintLayoutKind;
  content?: string;
  level?: number;
  token?: string;
  spacerHeight?: number;
}

export type PrintLayoutDocument = PrintLayoutBlock[];

export interface LetterTemplateSummary {
  id: string;
  name: string;
  category: string;
  status: string;
  description?: string | null;
  updatedAt: string;
  _count?: {
    generatedLetters?: number;
  };
}

export interface GeneratedLetterSummary {
  id: string;
  templateId: string;
  constituentId?: string | null;
  sourceTaskId?: string | null;
  stewardPathEnrollmentId?: string | null;
  stewardPathStepRunId?: string | null;
  category: string;
  status: string;
  generatedAt: string;
  mailedAt?: string | null;
  mergedPrintSubject?: string | null;
  mergedPrintBody?: string | null;
  mergedEmailBody?: string | null;
  emailCampaignId?: string | null;
  emailDraftCreatedAt?: string | null;
  template?: {
    id: string;
    name: string;
    category: string;
  };
  constituent?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string | null;
  };
}

export interface SignatureBlock {
  id: string;
  name: string;
  signerName: string;
  signerTitle?: string | null;
  closingPhrase?: string | null;
  isDefault: boolean;
  isActive: boolean;
}

export interface HeaderPreset {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  logoAlignment: string;
}

export interface FooterPreset {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
}

export interface MergeFieldSection {
  key: string;
  label: string;
  sensitive: boolean;
  fields: string[];
}

export interface LetterDashboardStats {
  activeTemplates: number;
  generatedThisMonth: number;
  thankYouPending: number;
  taxReceiptsGenerated: number;
  emailDrafts: number;
  needsReview: number;
  queuedForPrint: number;
  printedToday: number;
  queuedForMail: number;
  mailedThisWeek: number;
  addressIssues: number;
  pdfExportFailures: number;
  emailDraftsCreated: number;
  recentlyUsedTemplates: Array<{
    id: string;
    name: string;
    category: string;
    status: string;
    updatedAt: string;
  }>;
  batchGenerationStatus: string;
  pdfExportStatus: string;
}

export interface LetterQueuePerson {
  id: string;
  firstName: string;
  lastName: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  doNotMail?: boolean | null;
}

export interface LetterQueueTemplateRef {
  id: string;
  name: string;
  category: string;
}

export interface LetterPrintQueueItem {
  id: string;
  status: string;
  generatedAt: string;
  printedAt?: string | null;
  queueStatus: string;
  reviewStatus: string;
  priority: string;
  batchId?: string | null;
  statusNote?: string | null;
  addressComplete: boolean;
  constituent?: LetterQueuePerson | null;
  template?: LetterQueueTemplateRef | null;
}

export interface LetterMailQueueItem {
  id: string;
  status: string;
  generatedAt: string;
  mailedAt?: string | null;
  queueStatus: string;
  priority: string;
  batchId?: string | null;
  statusNote?: string | null;
  returnReason?: string | null;
  returnedAt?: string | null;
  addressComplete: boolean;
  addressWarning?: string | null;
  constituent?: LetterQueuePerson | null;
  template?: LetterQueueTemplateRef | null;
}
