/** Shared type contracts for the Letters & Printables workspace UI. */

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
  category: string;
  status: string;
  generatedAt: string;
  mailedAt?: string | null;
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
