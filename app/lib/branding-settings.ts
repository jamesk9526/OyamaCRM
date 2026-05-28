/** Shared branding settings helpers consumed by Settings pages and design-aware builders. */
import { apiFetch } from "@/app/lib/auth-client";

/** Canonical org branding shape used as a cross-module source of truth. */
export interface BrandingSettings {
  primaryColor: string;
  accentColor: string;
  emailBackgroundColor: string;
  emailFontFamily: string;
  emailContentWidth: number;
  logoUrl: string;
  logoSquareUrl: string;
  organizationDisplayName: string;
  legalOrganizationName: string;
  tagline: string;
  missionStatement: string;
  contactEmail: string;
  contactPhone: string;
  websiteUrl: string;
  streetAddress1: string;
  streetAddress2: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
  locationName: string;
  taxId: string;
  footerLegalText: string;
  socialFacebook: string;
  socialInstagram: string;
  socialLinkedIn: string;
  socialYoutube: string;
  socialX: string;
  defaultLetterSignatureBlockId: string;
  defaultLetterSignatureName: string;
  defaultLetterSignerName: string;
  defaultLetterSignerTitle: string;
  defaultLetterClosingPhrase: string;
  defaultLetterSignatureImageUrl: string;
  defaultLetterTypedSignature: string;
  defaultLetterSignerEmail: string;
  defaultLetterSignerPhone: string;
}

/** Stable defaults used when branding has not been configured yet. */
export const DEFAULT_BRANDING_SETTINGS: BrandingSettings = {
  primaryColor: "#16a34a",
  accentColor: "#0f766e",
  emailBackgroundColor: "#f5f5f5",
  emailFontFamily: "Arial, Helvetica, sans-serif",
  emailContentWidth: 600,
  logoUrl: "",
  logoSquareUrl: "",
  organizationDisplayName: "",
  legalOrganizationName: "",
  tagline: "",
  missionStatement: "",
  contactEmail: "",
  contactPhone: "",
  websiteUrl: "",
  streetAddress1: "",
  streetAddress2: "",
  city: "",
  stateProvince: "",
  postalCode: "",
  country: "",
  locationName: "",
  taxId: "",
  footerLegalText: "",
  socialFacebook: "",
  socialInstagram: "",
  socialLinkedIn: "",
  socialYoutube: "",
  socialX: "",
  defaultLetterSignatureBlockId: "",
  defaultLetterSignatureName: "",
  defaultLetterSignerName: "",
  defaultLetterSignerTitle: "",
  defaultLetterClosingPhrase: "",
  defaultLetterSignatureImageUrl: "",
  defaultLetterTypedSignature: "",
  defaultLetterSignerEmail: "",
  defaultLetterSignerPhone: "",
};

/** Normalizes unknown branding payloads from APIs to safe UI-ready values. */
export function normalizeBrandingSettings(input: unknown): BrandingSettings {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ...DEFAULT_BRANDING_SETTINGS };
  }
  const raw = input as Record<string, unknown>;

  const normalizeText = (value: unknown, fallback = "") => String(value ?? fallback).trim();
  const normalizeHex = (value: unknown, fallback: string) => {
    const next = normalizeText(value, fallback);
    return /^#[0-9a-fA-F]{6}$/.test(next) ? next : fallback;
  };
  const normalizeWidth = (value: unknown, fallback: number) => {
    const parsed = Number.parseInt(String(value ?? ""), 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(760, Math.max(420, parsed));
  };

  return {
    primaryColor: normalizeHex(raw.primaryColor, DEFAULT_BRANDING_SETTINGS.primaryColor),
    accentColor: normalizeHex(raw.accentColor, DEFAULT_BRANDING_SETTINGS.accentColor),
    emailBackgroundColor: normalizeHex(raw.emailBackgroundColor, DEFAULT_BRANDING_SETTINGS.emailBackgroundColor),
    emailFontFamily: normalizeText(raw.emailFontFamily, DEFAULT_BRANDING_SETTINGS.emailFontFamily),
    emailContentWidth: normalizeWidth(raw.emailContentWidth, DEFAULT_BRANDING_SETTINGS.emailContentWidth),
    logoUrl: normalizeText(raw.logoUrl),
    logoSquareUrl: normalizeText(raw.logoSquareUrl),
    organizationDisplayName: normalizeText(raw.organizationDisplayName),
    legalOrganizationName: normalizeText(raw.legalOrganizationName),
    tagline: normalizeText(raw.tagline),
    missionStatement: normalizeText(raw.missionStatement),
    contactEmail: normalizeText(raw.contactEmail),
    contactPhone: normalizeText(raw.contactPhone),
    websiteUrl: normalizeText(raw.websiteUrl),
    streetAddress1: normalizeText(raw.streetAddress1),
    streetAddress2: normalizeText(raw.streetAddress2),
    city: normalizeText(raw.city),
    stateProvince: normalizeText(raw.stateProvince),
    postalCode: normalizeText(raw.postalCode),
    country: normalizeText(raw.country),
    locationName: normalizeText(raw.locationName),
    taxId: normalizeText(raw.taxId),
    footerLegalText: normalizeText(raw.footerLegalText),
    socialFacebook: normalizeText(raw.socialFacebook),
    socialInstagram: normalizeText(raw.socialInstagram),
    socialLinkedIn: normalizeText(raw.socialLinkedIn),
    socialYoutube: normalizeText(raw.socialYoutube),
    socialX: normalizeText(raw.socialX),
    defaultLetterSignatureBlockId: normalizeText(raw.defaultLetterSignatureBlockId),
    defaultLetterSignatureName: normalizeText(raw.defaultLetterSignatureName),
    defaultLetterSignerName: normalizeText(raw.defaultLetterSignerName),
    defaultLetterSignerTitle: normalizeText(raw.defaultLetterSignerTitle),
    defaultLetterClosingPhrase: normalizeText(raw.defaultLetterClosingPhrase),
    defaultLetterSignatureImageUrl: normalizeText(raw.defaultLetterSignatureImageUrl),
    defaultLetterTypedSignature: normalizeText(raw.defaultLetterTypedSignature),
    defaultLetterSignerEmail: normalizeText(raw.defaultLetterSignerEmail),
    defaultLetterSignerPhone: normalizeText(raw.defaultLetterSignerPhone),
  };
}

/** Loads branding settings with resilient fallback for unauthenticated/failed API calls. */
export async function fetchBrandingSettings(): Promise<BrandingSettings> {
  try {
    const payload = await apiFetch<BrandingSettings>("/api/settings/branding");
    return normalizeBrandingSettings(payload);
  } catch {
    return { ...DEFAULT_BRANDING_SETTINGS };
  }
}

/** Converts address fields into one readable single-line location string. */
export function formatBrandingAddress(settings: BrandingSettings): string {
  const parts = [
    settings.streetAddress1,
    settings.streetAddress2,
    [settings.city, settings.stateProvince].filter(Boolean).join(", "),
    settings.postalCode,
    settings.country,
  ].map((part) => part.trim()).filter(Boolean);

  return parts.join(" • ");
}
