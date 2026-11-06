import type { ClassicRegion } from "./studio/html-document.js";
import type { StudioDesign } from "./studio/types.js";

export const CLASSIC_PAPERS = {
  LETTER: "Letter (8.5 x 11 in)",
  LEGAL: "Legal (8.5 x 14 in)",
  A4: "A4 (8.27 x 11.69 in)",
  HALF_LETTER: "Half Letter (5.5 x 8.5 in)",
} as const;

export type ClassicLetterSettings = {
  headerMode: "ORGANIZATION" | "RECIPIENT" | "CUSTOM";
  headerHtml: string;
  footerHtml: string;
  giftSelections?: Record<string, string>;
};

export type ClassicLetterAdvanced = Pick<StudioDesign, "page" | "styles" | "data"> & {
  regions: Record<Exclude<ClassicRegion, "body" | "replySlip">, { mode: "brand" | "custom" | "none"; presetId: string }>;
  html: Record<Exclude<ClassicRegion, "body">, string>;
  pack: Omit<StudioDesign["pack"], "replySlip"> & { replySlip: Omit<StudioDesign["pack"]["replySlip"], "content"> };
  blocks?: ClassicCrmBlock[];
};

export const CLASSIC_CRM_FIELDS = {
  studioSignature: ["signerId", "secondSignerId", "closing"],
  studioAsk: ["basis", "amounts", "multipliers", "fallback", "minimum", "maximum", "rounding", "label"],
  studioCondition: ["field", "operator", "value"],
  studioHistory: ["mode"],
  studioReceipt: ["statement"],
  studioField: ["field"],
  studioGiving: ["label"],
  studioResponse: ["label", "amounts"],
  studioPledge: [],
} as const;
export type ClassicCrmBlock = { id: string; type: keyof typeof CLASSIC_CRM_FIELDS; attrs: Record<string, unknown>; contentHtml?: string };

export type ClassicLetterDraft = {
  name: string;
  description: string;
  category: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  printSubject: string;
  printBody: string;
  emailSubject: string;
  emailBody: string;
  headerPresetId: string;
  footerPresetId: string;
  signatureBlockId: string;
  logoMode: string;
  customLogoUrl: string;
  printLayoutJson: unknown;
};

export type ClassicLetterResponse = {
  template: ClassicLetterDraft;
  revision: number;
  campaignRevision: number;
  letterRevision: number;
  renderer: "classic" | "studio";
  settings: ClassicLetterSettings;
  advanced: ClassicLetterAdvanced | null;
  logoUrl: string;
  brandName: string;
  signature: { name: string; title: string; imageUrl: string; closing: string } | null;
  diagnostics: string[];
  needsReview: boolean;
  saved: boolean;
  signers?: Array<{ id: string; name: string }>;
};
