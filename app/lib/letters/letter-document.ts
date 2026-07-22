import {
  DEFAULT_BRANDING_SETTINGS,
  formatBrandingAddress,
  normalizeBrandingSettings,
  type BrandingSettings,
} from "@/app/lib/branding-settings";

export type LetterDocumentWorkspace = "oyamaLetters" | "emailWorkspace" | "donorCrm" | "communications";

export interface LetterDocumentRecipient {
  displayName: string;
  organization?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  email?: string;
}

export interface LetterDocumentSender {
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  signatureUrl?: string;
}

export interface LetterDocumentBrandingSnapshot {
  primaryColor: string;
  accentColor: string;
  organizationName: string;
  legalOrganizationName?: string;
  tagline?: string;
  logoUrl?: string;
  logoSquareUrl?: string;
  address: string;
  contactEmail?: string;
  contactPhone?: string;
  websiteUrl?: string;
  footerLegalText?: string;
}

export interface LetterDocumentFooterBlock {
  label: string;
  text: string;
}

export interface LetterDocument {
  id: string;
  templateId?: string;
  workspace: LetterDocumentWorkspace;
  title: string;
  generatedAtIso: string;
  branding: BrandingSettings;
  brandingSnapshot: LetterDocumentBrandingSnapshot;
  recipient: LetterDocumentRecipient;
  sender: LetterDocumentSender;
  content: {
    date: string;
    subject: string;
    salutation: string;
    bodyHtml: string;
    closing: string;
  };
  footer: {
    enabled: boolean;
    blocks: LetterDocumentFooterBlock[];
  };
  layout: {
    pageSize: "letter";
    orientation: "portrait";
    marginTop: number;
    marginRight: number;
    marginBottom: number;
    marginLeft: number;
  };
  diagnostics: {
    usesSampleRecipient: boolean;
    hasBodyHtml: boolean;
    hasBrandingConfigured: boolean;
  };
}

export interface BuildLetterDocumentInput {
  id: string;
  templateId?: string;
  workspace?: LetterDocumentWorkspace;
  title: string;
  branding?: BrandingSettings | null;
  recipient?: Partial<LetterDocumentRecipient> | null;
  sender?: Partial<LetterDocumentSender> | null;
  date?: string | null;
  subject?: string | null;
  salutation?: string | null;
  bodyHtml?: string | null;
  closing?: string | null;
  footerEnabled?: boolean;
  footerBlocks?: LetterDocumentFooterBlock[];
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  generatedAtIso?: string;
}

function clean(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function compactBlocks(blocks: LetterDocumentFooterBlock[]): LetterDocumentFooterBlock[] {
  return blocks
    .map((block) => ({ label: clean(block.label), text: clean(block.text) }))
    .filter((block) => block.label && block.text);
}

function formatDisplayDate(input?: string | null): string {
  const raw = clean(input);
  if (raw) return raw;
  return new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function buildLetterBrandingSnapshot(brandingInput?: BrandingSettings | null): LetterDocumentBrandingSnapshot {
  const branding = normalizeBrandingSettings(brandingInput ?? DEFAULT_BRANDING_SETTINGS);
  const organizationName = clean(branding.organizationDisplayName)
    || clean(branding.legalOrganizationName)
    || "Organization";

  return {
    primaryColor: branding.primaryColor || DEFAULT_BRANDING_SETTINGS.primaryColor,
    accentColor: branding.accentColor || DEFAULT_BRANDING_SETTINGS.accentColor,
    organizationName,
    legalOrganizationName: clean(branding.legalOrganizationName),
    tagline: clean(branding.tagline),
    logoUrl: clean(branding.logoUrl),
    logoSquareUrl: clean(branding.logoSquareUrl),
    address: formatBrandingAddress(branding),
    contactEmail: clean(branding.contactEmail),
    contactPhone: clean(branding.contactPhone),
    websiteUrl: clean(branding.websiteUrl),
    footerLegalText: clean(branding.footerLegalText),
  };
}

export function buildLetterDocument(input: BuildLetterDocumentInput): LetterDocument {
  const branding = normalizeBrandingSettings(input.branding ?? DEFAULT_BRANDING_SETTINGS);
  const brandingSnapshot = buildLetterBrandingSnapshot(branding);
  const sampleRecipientName = "Sample Preview Recipient";
  const recipientName = clean(input.recipient?.displayName) || sampleRecipientName;
  const senderName = clean(input.sender?.name)
    || clean(branding.defaultLetterSignerName)
    || brandingSnapshot.organizationName;
  const senderEmail = clean(input.sender?.email) || clean(branding.defaultLetterSignerEmail) || clean(branding.contactEmail);
  const senderPhone = clean(input.sender?.phone) || clean(branding.defaultLetterSignerPhone) || clean(branding.contactPhone);
  const closing = clean(input.closing) || clean(branding.defaultLetterClosingPhrase) || "With gratitude,";
  const defaultFooterBlocks = compactBlocks([
    { label: "Email", text: senderEmail || clean(branding.contactEmail) },
    { label: "Phone", text: senderPhone || clean(branding.contactPhone) },
    { label: "Web", text: clean(branding.websiteUrl) },
  ]);

  return {
    id: input.id,
    templateId: input.templateId,
    workspace: input.workspace ?? "oyamaLetters",
    title: clean(input.title) || "Untitled Letter",
    generatedAtIso: input.generatedAtIso ?? new Date().toISOString(),
    branding,
    brandingSnapshot,
    recipient: {
      displayName: recipientName,
      organization: clean(input.recipient?.organization),
      addressLine1: clean(input.recipient?.addressLine1),
      addressLine2: clean(input.recipient?.addressLine2),
      city: clean(input.recipient?.city),
      state: clean(input.recipient?.state),
      postalCode: clean(input.recipient?.postalCode),
      email: clean(input.recipient?.email),
    },
    sender: {
      name: senderName,
      title: clean(input.sender?.title) || clean(branding.defaultLetterSignerTitle),
      email: senderEmail,
      phone: senderPhone,
      signatureUrl: clean(input.sender?.signatureUrl) || clean(branding.defaultLetterSignatureImageUrl),
    },
    content: {
      date: formatDisplayDate(input.date),
      subject: clean(input.subject) || clean(input.title),
      salutation: input.salutation === null ? "" : clean(input.salutation) || `Dear ${recipientName},`,
      bodyHtml: input.bodyHtml ?? "",
      closing,
    },
    footer: {
      enabled: input.footerEnabled ?? true,
      blocks: input.footerBlocks ? compactBlocks(input.footerBlocks) : defaultFooterBlocks,
    },
    layout: {
      pageSize: "letter",
      orientation: "portrait",
      marginTop: input.marginTop ?? 0.6,
      marginRight: input.marginRight ?? 0.6,
      marginBottom: input.marginBottom ?? 0.5,
      marginLeft: input.marginLeft ?? 0.6,
    },
    diagnostics: {
      usesSampleRecipient: recipientName === sampleRecipientName,
      hasBodyHtml: Boolean(clean(input.bodyHtml)),
      hasBrandingConfigured: Boolean(clean(branding.organizationDisplayName) || clean(branding.legalOrganizationName)),
    },
  };
}
