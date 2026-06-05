import { prisma } from "../lib/prisma.js";

const BRANDING_PLUGIN_KEY = "organization-branding";

type BrandingConfig = Record<string, unknown>;

export type OrganizationBrandingContext = {
  organizationName: string;
  legalOrganizationName: string;
  contactEmail: string;
  contactPhone: string;
  websiteUrl: string;
  addressLine: string;
  taxId: string;
  defaultSignerTitle: string;
};

function asObject(value: unknown): BrandingConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as BrandingConfig;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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
    contactEmail: asText(config.contactEmail),
    contactPhone: asText(config.contactPhone),
    websiteUrl: asText(config.websiteUrl),
    addressLine: formatAddress(config),
    taxId: asText(config.taxId),
    defaultSignerTitle: asText(config.defaultLetterSignerTitle),
  };
}
