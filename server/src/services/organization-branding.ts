import { prisma } from "../lib/prisma.js";

const BRANDING_PLUGIN_KEY = "organization-branding";

type BrandingConfig = Record<string, unknown>;

export type OrganizationBrandingContext = {
  organizationName: string;
  legalOrganizationName: string;
  tagline: string;
  logoUrl: string;
  logoSquareUrl: string;
  primaryColor: string;
  accentColor: string;
  emailBackgroundColor: string;
  emailFontFamily: string;
  emailContentWidth: number;
  contactEmail: string;
  contactPhone: string;
  websiteUrl: string;
  addressLine: string;
  taxId: string;
  footerLegalText: string;
  globalHeaderHtml: string;
  globalFooterHtml: string;
  defaultSignerTitle: string;
  /** Public CRM origin used to turn stored /uploads paths into recipient-loadable email URLs. */
  publicAssetBaseUrl: string;
};

function asObject(value: unknown): BrandingConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as BrandingConfig;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asHex(value: unknown, fallback: string): string {
  const next = asText(value);
  return /^#[0-9a-fA-F]{6}$/.test(next) ? next : fallback;
}

function asWidth(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return 600;
  return Math.min(760, Math.max(420, parsed));
}

function publicAssetBaseUrl(): string {
  const configured = String(process.env.NEXT_PUBLIC_APP_URL || process.env.FRONTEND_ORIGIN || "").trim();
  try {
    const parsed = new URL(configured || "http://localhost:3000");
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "http://localhost:3000";
    return parsed.origin;
  } catch {
    return "http://localhost:3000";
  }
}

function joinParts(parts: Array<string | null | undefined>, separator: string): string {
  return parts.map((part) => String(part ?? "").trim()).filter(Boolean).join(separator);
}

function formatAddress(config: BrandingConfig): string {
  const locality = joinParts([
    asText(config.city),
    asText(config.stateProvince),
    asText(config.postalCode),
  ], ", ");

  return joinParts([
    asText(config.locationName),
    asText(config.streetAddress1),
    asText(config.streetAddress2),
    locality,
    asText(config.country),
  ], ", ");
}

export async function loadOrganizationBrandingContext(
  organizationId: string,
  fallbackOrganizationName = "",
): Promise<OrganizationBrandingContext> {
  const setting = await prisma.pluginSetting.findUnique({
    where: {
      organizationId_pluginKey: {
        organizationId,
        pluginKey: BRANDING_PLUGIN_KEY,
      },
    },
    select: { config: true },
  });

  const config = asObject(setting?.config);
  const organizationName =
    asText(config.organizationDisplayName)
    || asText(config.legalOrganizationName)
    || fallbackOrganizationName.trim();

  return {
    organizationName,
    legalOrganizationName: asText(config.legalOrganizationName) || organizationName,
    tagline: asText(config.tagline),
    logoUrl: asText(config.logoUrl),
    logoSquareUrl: asText(config.logoSquareUrl),
    primaryColor: asHex(config.primaryColor, "#16a34a"),
    accentColor: asHex(config.accentColor, "#0f766e"),
    emailBackgroundColor: asHex(config.emailBackgroundColor, "#f5f5f5"),
    emailFontFamily: asText(config.emailFontFamily) || "Arial, Helvetica, sans-serif",
    emailContentWidth: asWidth(config.emailContentWidth),
    contactEmail: asText(config.contactEmail),
    contactPhone: asText(config.contactPhone),
    websiteUrl: asText(config.websiteUrl),
    addressLine: formatAddress(config),
    taxId: asText(config.taxId),
    footerLegalText: asText(config.footerLegalText),
    globalHeaderHtml: asText(config.globalHeaderHtml),
    globalFooterHtml: asText(config.globalFooterHtml),
    defaultSignerTitle: asText(config.defaultLetterSignerTitle),
    publicAssetBaseUrl: publicAssetBaseUrl(),
  };
}
