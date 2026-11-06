/** Portable, frozen inputs. No renderer is allowed to look up current CRM data. */
export const LETTER_RENDERER_VERSION = "chromium-letters-v2.1";
export const CLASSIC_LETTER_RENDERER_VERSION = "classic-letters-v1";
export type FrozenClassicLetter = {
  version: 1;
  branding: import("../routes/letters.js").LetterPdfBrandingContext;
  presets: import("../routes/letters.js").LetterPdfPresetContext;
  logoSource: string;
  printLayout: unknown;
  sensitive: boolean;
  sample: boolean;
};
export interface LetterSnapshot {
  version: 2;
  organizationId: string;
  templateId: string;
  revision: number;
  generatedLetterId?: string;
  title: string;
  subject: string;
  bodyHtml: string;
  generatedAt: string;
  recipientId: string | null;
  recipient: { name: string; addressLine1: string; addressLine2: string; city: string; state: string; zip: string };
  branding: Record<string, unknown>;
  header: Record<string, unknown>;
  footer: Record<string, unknown>;
  signature: Record<string, unknown>;
  layout: { paper: "Letter" | "A4" | "Legal"; margins: { top: number; right: number; bottom: number; left: number } };
  assets: Record<string, string>;
  warnings: string[];
  blockers: string[];
  studio?: import("../oyama-create/studio/types.js").FrozenStudioPrint;
  classic?: FrozenClassicLetter;
}
export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function string(value: unknown): string { return typeof value === "string" ? value : ""; }
export function productionLayout(value: unknown): LetterSnapshot["layout"] {
  const raw = record(record(value).letterPdfLayout ?? value);
  const margins = record(raw.margins);
  const margin = (key: string) => typeof margins[key] === "number" && Number.isFinite(margins[key]) ? Math.min(1.5, Math.max(.125, margins[key] as number)) : .75;
  const paper = string(raw.pageSize);
  return { paper: paper.startsWith("A4") ? "A4" : paper.startsWith("Legal") ? "Legal" : "Letter", margins: { top: margin("top"), right: margin("right"), bottom: margin("bottom"), left: margin("left") } };
}
export function addressFingerprint(recipient: LetterSnapshot["recipient"]): string {
  return JSON.stringify(Object.values(recipient).map(value => value.trim()));
}
