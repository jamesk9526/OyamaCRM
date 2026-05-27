/** Pure rendering helpers for printable letterhead branding and preset behavior. */
import type { BrandingSettings } from "@/lib/branding-settings";
import type { FooterPreset, HeaderPreset } from "@/components/letters/types";

export type HeaderLogoAlignment = "LEFT" | "CENTER" | "RIGHT" | "NONE";

/** Returns the organization's configured default logo URL for printable previews. */
export function resolveLetterLogoUrl(logoUrl?: string | null, logoSquareUrl?: string | null): string | null {
  const normalized = String(logoUrl ?? "").trim();
  const normalizedSquare = String(logoSquareUrl ?? "").trim();
  return normalized || normalizedSquare || null;
}

/** Normalizes preset alignment values coming from older rows or partial API payloads. */
export function normalizeHeaderLogoAlignment(alignment?: string | null): HeaderLogoAlignment {
  const normalized = String(alignment ?? "LEFT").trim().toUpperCase();
  if (normalized === "CENTER" || normalized === "RIGHT" || normalized === "NONE") return normalized;
  return "LEFT";
}

/** Indicates whether a printable header should reserve space for a logo. */
export function shouldShowLetterLogo(header?: Pick<HeaderPreset, "logoAlignment"> | null): boolean {
  return normalizeHeaderLogoAlignment(header?.logoAlignment) !== "NONE";
}

/** Builds the preset-aware footer contact line from organization branding. */
export function buildLetterFooterContactLine(branding: BrandingSettings, footer?: FooterPreset | null): string {
  return [
    (footer?.showPhone ?? true) ? branding.contactPhone : "",
    (footer?.showEmail ?? true) ? branding.contactEmail : "",
    (footer?.showWebsite ?? true) ? branding.websiteUrl : "",
  ]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" | ");
}
