import { CreateError, object, string } from "../domain.js";
import { EMPTY_DOC, type BrandDocument, type BrandPreset, type BrandSigner, type BrandProfile } from "./types.js";
import { normalizeDoc, studioUrl } from "./design.js";

export const BRAND_IDENTITY_FIELDS = ["organizationDisplayName", "legalOrganizationName", "tagline", "missionStatement", "logoUrl", "logoSquareUrl", "primaryColor", "accentColor", "emailBackgroundColor", "emailFontFamily", "emailContentWidth", "contactEmail", "contactPhone", "websiteUrl", "streetAddress1", "streetAddress2", "city", "stateProvince", "postalCode", "country", "locationName", "taxId", "footerLegalText", "globalHeaderHtml", "globalFooterHtml", "socialFacebook", "socialInstagram", "socialLinkedIn", "socialYoutube", "socialX", "currency"] as const;
export const BRAND_CHANNELS = ["LETTER", "EMAIL", "WEB", "GIVING", "EVENT", "WIDGET"] as const;
export const WIDGET_BRAND_FIELDS = ["appearance.accentColor", "appearance.backgroundColor", "appearance.textColor", "appearance.mutedTextColor", "appearance.borderColor", "appearance.density", "appearance.themeMode", "appearance.cornerRadius", "appearance.cardStyle", "appearance.buttonStyle", "appearance.fontFamily", "widgets.liveCom.orgName", "widgets.liveCom.orgSubtitle", "widgets.liveCom.avatarUrl", "widgets.liveCom.chatheadColor", ...["donation_widget", "campaign_meter", "event_card", "volunteer_signup", "newsletter_signup", "impact_counter", "cta_block"].map(key => `widgets.${key}.accentColor`)];
const PROFILE_FIELDS = new Set([...WIDGET_BRAND_FIELDS, ...BRAND_IDENTITY_FIELDS, "fontFamily", "fontSize", "lineHeight", "headingFontFamily", "backgroundColor", "textColor", "buttonColor", "borderColor", "borderRadius", "headerPresetId", "footerPresetId", "signerId", "organizationName", "addressLine", "theme"]);
function text(value: unknown, max = 2000) { const result = string(value).trim(); if (result.length > max) throw new CreateError(400, "A brand field exceeds its length limit."); return result; }
function id(value: unknown) { const result = text(value, 191); if (!/^[a-z0-9:_-]+$/i.test(result)) throw new CreateError(400, "Brand component identities must contain letters, numbers, hyphens or underscores."); return result; }
function unique<T extends { id: string }>(items: T[]): T[] { if (new Set(items.map(item => item.id)).size !== items.length) throw new CreateError(400, "Brand component identities must be unique."); return items; }
function array(value: unknown, max: number): unknown[] { if (value === undefined) return []; if (!Array.isArray(value) || value.length > max) throw new CreateError(400, "Too many brand components."); return value; }
export function normalizeBrand(value: unknown): BrandDocument {
  const raw = object(value); if (raw.version !== 1) throw new CreateError(400, "A version 1 brand document is required.");
  const identity: BrandDocument["identity"] = {};
  for (const key of BRAND_IDENTITY_FIELDS) {
    const source = object(raw.identity)[key];
    if (key === "emailContentWidth") { identity[key] = typeof source === "number" && Number.isFinite(source) ? Math.max(420, Math.min(760, source)) : 600; continue; }
    const entry = text(source, /Html$/.test(key) ? 100000 : key === "missionStatement" ? 10000 : 2000);
    if (/Color$/.test(key) && entry && !/^#[a-f0-9]{6}$/i.test(entry)) throw new CreateError(400, `Choose a valid ${key}.`);
    identity[key] = key === "logoUrl" || key === "logoSquareUrl" ? studioUrl(entry, true) : entry;
  }
  if (identity.currency && !/^[A-Z]{3}$/.test(String(identity.currency))) throw new CreateError(400, "Choose a three-letter currency code.");
  const signers: BrandSigner[] = unique(array(raw.signers, 200).map(value => { const signer = object(value); return { id: id(signer.id), name: text(signer.name, 191), signerName: text(signer.signerName, 191), signerTitle: text(signer.signerTitle, 191), closingPhrase: text(signer.closingPhrase, 500), signatureImageUrl: studioUrl(signer.signatureImageUrl, true), typedSignature: text(signer.typedSignature, 191), email: text(signer.email, 320), phone: text(signer.phone, 80), active: signer.active !== false }; }));
  const presets: BrandPreset[] = unique(array(raw.presets, 200).map(value => { const preset = object(value); if (!["header", "footer"].includes(string(preset.kind))) throw new CreateError(400, "Choose a header or footer preset."); return { id: id(preset.id), name: text(preset.name, 191), kind: preset.kind as "header" | "footer", content: preset.content ? normalizeDoc(preset.content) : EMPTY_DOC(), ...(preset.legacyHtml ? { legacyHtml: text(preset.legacyHtml, 100000) } : {}), active: preset.active !== false, isDefault: preset.isDefault === true }; }));
  const profiles: BrandProfile[] = unique(array(raw.profiles, 500).map(value => { const profile = object(value), values: BrandProfile["values"] = {}; if (!(BRAND_CHANNELS as readonly string[]).includes(string(profile.channel))) throw new CreateError(400, "Choose a supported output channel."); for (const [key, item] of Object.entries(object(profile.values))) { if (!PROFILE_FIELDS.has(key)) throw new CreateError(400, `Unsupported brand profile property: ${key}.`); if (typeof item !== "string" && typeof item !== "number" && typeof item !== "boolean" || typeof item === "number" && !Number.isFinite(item)) throw new CreateError(400, "Invalid profile value."); if (typeof item === "string" && item.length > 100000) throw new CreateError(400, "Profile value is too large."); if (/Color$/.test(key) && item && !/^#[a-f0-9]{6}$/i.test(String(item))) throw new CreateError(400, "Choose a valid profile color."); values[key] = /logo.*Url/.test(key) || key.endsWith("avatarUrl") ? studioUrl(item, true) : item; } return { id: id(profile.id), name: text(profile.name, 191), channel: profile.channel as BrandProfile["channel"], resourceId: text(profile.resourceId, 191), values }; }));
  const enums:Record<string,string[]>={"appearance.themeMode":["light","soft","transparent"],"appearance.density":["comfortable","compact"],"appearance.cornerRadius":["square","soft","rounded"],"appearance.cardStyle":["flat","bordered","elevated"],"appearance.buttonStyle":["solid","soft","outline"],"appearance.fontFamily":["system","serif","rounded"]};
  for(const profile of profiles)for(const [key,choices] of Object.entries(enums))if(key in profile.values&&!choices.includes(String(profile.values[key])))throw new CreateError(400,`Choose a supported ${key}.`);
  const defaultSignerId = string(raw.defaultSignerId) || null;
  if (defaultSignerId && !signers.some(signer => signer.id === defaultSignerId && signer.active)) throw new CreateError(400, "Choose an active default signer.");
  for (const kind of ["header", "footer"]) if (presets.filter(preset => preset.kind === kind && preset.active && preset.isDefault).length > 1) throw new CreateError(400, `Choose only one default ${kind}.`);
  const result: BrandDocument = { version: 1, identity, signers, presets, profiles, defaultSignerId };
  if (JSON.stringify(result).length > 3_000_000) throw new CreateError(400, "The brand document exceeds 3 MB.");
  return result;
}
export function legacyBrandProjection(brand: BrandDocument): Record<string, unknown> {
  const signer = brand.signers.find(item => item.id === brand.defaultSignerId && item.active);
  return { ...brand.identity, defaultLetterSignatureBlockId: signer?.id || "", defaultLetterSignatureName: signer?.name || "", defaultLetterSignerName: signer?.signerName || "", defaultLetterSignerTitle: signer?.signerTitle || "", defaultLetterClosingPhrase: signer?.closingPhrase || "", defaultLetterSignatureImageUrl: signer?.signatureImageUrl || "", defaultLetterTypedSignature: signer?.typedSignature || "", defaultLetterSignerEmail: signer?.email || "", defaultLetterSignerPhone: signer?.phone || "" };
}
export function profileIdentity(brand: BrandDocument, channel: BrandProfile["channel"], resourceId = "", profileId = "") {
  const inherited = brand.profiles.find(item => item.channel === channel && !item.resourceId);
  const resource = resourceId ? brand.profiles.find(item => item.channel === channel && item.resourceId === resourceId) : undefined;
  const selected = profileId ? brand.profiles.find(item => item.id === profileId && item.channel === channel) : undefined;
  return { ...brand.identity, ...inherited?.values, ...resource?.values, ...selected?.values };
}
