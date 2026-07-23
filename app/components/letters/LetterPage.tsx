import type { CSSProperties, ReactNode } from "react";
import {
  DEFAULT_BRANDING_SETTINGS,
  formatBrandingAddress,
  type BrandingSettings,
} from "@/app/lib/branding-settings";
import type { LetterDocument } from "@/app/lib/letters/letter-document";

export interface LetterPageRecipient {
  displayName?: string | null;
  organization?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
}

export interface LetterPageSender {
  name?: string | null;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  signatureUrl?: string | null;
  closing?: string | null;
}

export interface LetterPageFooterBlock {
  icon?: string;
  label: string;
  text: string;
}

export interface LetterPageProps {
  document?: LetterDocument;
  branding?: BrandingSettings;
  title?: string;
  date?: string;
  subject?: string | null;
  salutation?: string | null;
  bodyHtml?: string;
  bodySlot?: ReactNode;
  recipient?: LetterPageRecipient | null;
  sender?: LetterPageSender | null;
  footerEnabled?: boolean;
  footerBlocks?: LetterPageFooterBlock[];
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  className?: string;
  minHeight?: number | string;
  screenShadow?: boolean;
  fixedHeight?: boolean;
  autoSignature?: boolean;
  headerRightColumnMode?: "ORGANIZATION" | "RECIPIENT" | "CUSTOM";
  headerRightColumnHtml?: string | null;
}

const LETTER_WIDTH_PX = 816;
const LETTER_HEIGHT_PX = 1056;

function clean(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function formatRecipientAddress(recipient: LetterPageRecipient | null | undefined): string[] {
  if (!recipient) return [];
  return [
    clean(recipient.organization),
    clean(recipient.addressLine1),
    clean(recipient.addressLine2),
    [recipient.city, recipient.state, recipient.postalCode].map(clean).filter(Boolean).join(", "),
  ].filter(Boolean);
}

export default function LetterPage({
  document,
  branding = DEFAULT_BRANDING_SETTINGS,
  title,
  date,
  subject,
  salutation,
  bodyHtml = "",
  bodySlot,
  recipient,
  sender,
  footerEnabled,
  footerBlocks = [],
  marginTop = 0.25,
  marginRight = 0.25,
  marginBottom = 0.25,
  marginLeft = 0.25,
  className = "",
  minHeight = LETTER_HEIGHT_PX,
  screenShadow = true,
  fixedHeight = false,
  autoSignature = true,
  headerRightColumnMode = "ORGANIZATION",
  headerRightColumnHtml,
}: LetterPageProps) {
  const resolvedBranding = document?.branding ?? branding;
  const resolvedTitle = title ?? document?.title;
  const resolvedDate = date ?? document?.content.date;
  const resolvedSalutation = salutation ?? document?.content.salutation;
  const resolvedBodyHtml = bodyHtml || document?.content.bodyHtml || "";
  const resolvedRecipient = recipient ?? document?.recipient;
  const resolvedSender = sender ?? (document
    ? {
        name: document.sender.name,
        title: document.sender.title,
        email: document.sender.email,
        phone: document.sender.phone,
        signatureUrl: document.sender.signatureUrl,
        closing: document.content.closing,
      }
    : null);
  const resolvedFooterEnabled = footerEnabled ?? document?.footer.enabled ?? true;
  const resolvedFooterBlocks = footerBlocks.length > 0 ? footerBlocks : document?.footer.blocks ?? [];
  const resolvedMarginTop = document?.layout.marginTop ?? marginTop;
  const resolvedMarginRight = document?.layout.marginRight ?? marginRight;
  const resolvedMarginBottom = document?.layout.marginBottom ?? marginBottom;
  const resolvedMarginLeft = document?.layout.marginLeft ?? marginLeft;
  const organizationName = clean(resolvedBranding.organizationDisplayName)
    || clean(resolvedBranding.legalOrganizationName)
    || "Organization";
  const primaryColor = clean(resolvedBranding.primaryColor) || DEFAULT_BRANDING_SETTINGS.primaryColor;
  const accentColor = clean(resolvedBranding.accentColor) || DEFAULT_BRANDING_SETTINGS.accentColor;
  const logoUrl = clean(resolvedBranding.logoUrl) || clean(resolvedBranding.logoSquareUrl);
  const senderName = clean(resolvedSender?.name) || clean(resolvedBranding.defaultLetterSignerName) || organizationName;
  const senderTitle = clean(resolvedSender?.title) || clean(resolvedBranding.defaultLetterSignerTitle);
  const senderEmail = clean(resolvedSender?.email) || clean(resolvedBranding.defaultLetterSignerEmail) || clean(resolvedBranding.contactEmail);
  const senderPhone = clean(resolvedSender?.phone) || clean(resolvedBranding.defaultLetterSignerPhone) || clean(resolvedBranding.contactPhone);
  const signatureUrl = clean(resolvedSender?.signatureUrl) || clean(resolvedBranding.defaultLetterSignatureImageUrl);
  const closing = clean(resolvedSender?.closing) || clean(resolvedBranding.defaultLetterClosingPhrase) || "With gratitude,";
  const recipientName = clean(resolvedRecipient?.displayName) || "Sample Preview Recipient";
  const recipientAddress = formatRecipientAddress(resolvedRecipient);
  const displayDate = clean(resolvedDate) || new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const displaySalutation = resolvedSalutation === null ? "" : clean(resolvedSalutation) || `Dear ${recipientName},`;
  const organizationHeaderLines = [
    formatBrandingAddress(resolvedBranding),
    clean(resolvedBranding.contactPhone),
    clean(resolvedBranding.contactEmail),
    clean(resolvedBranding.websiteUrl),
  ].filter(Boolean);
  const usesRecipientHeader = headerRightColumnMode === "RECIPIENT";
  const headerRightLines = usesRecipientHeader
    ? [recipientName, ...recipientAddress]
    : organizationHeaderLines;
  const displayFooterBlocks = resolvedFooterBlocks.length > 0
    ? resolvedFooterBlocks
    : [
        { label: "Email", text: senderEmail || clean(resolvedBranding.contactEmail) },
        { label: "Phone", text: senderPhone || clean(resolvedBranding.contactPhone) },
        { label: "Web", text: clean(resolvedBranding.websiteUrl) },
      ].filter((block) => block.text);

  const pageStyle = {
    "--letter-primary": primaryColor,
    "--letter-accent": accentColor,
    width: LETTER_WIDTH_PX,
    minHeight,
    ...(fixedHeight ? { height: minHeight } : {}),
    paddingTop: `${resolvedMarginTop}in`,
    paddingRight: `${resolvedMarginRight}in`,
    paddingBottom: `${resolvedMarginBottom}in`,
    paddingLeft: `${resolvedMarginLeft}in`,
  } as CSSProperties;

  return (
    <article
      className={[
        "letter-page flex flex-col bg-white text-slate-950 ring-1 ring-slate-300",
        fixedHeight ? "overflow-hidden" : "",
        screenShadow ? "shadow-[0_18px_45px_rgba(15,23,42,0.12)]" : "",
        className,
      ].filter(Boolean).join(" ")}
      style={pageStyle}
      aria-label={resolvedTitle || "Letter preview"}
    >
      <style>{`
        @page { size: Letter portrait; margin: 0; }
        @media print {
          body { margin: 0 !important; background: white !important; }
          .app-shell, .builder-sidebar, .letters-ribbon, .preview-controls, .non-printing { display: none !important; }
          .letter-page {
            width: 8.5in !important;
            min-height: 11in !important;
            box-shadow: none !important;
            margin: 0 !important;
            border: 0 !important;
            outline: 0 !important;
          }
        }
      `}</style>
      <header className="letter-page-header flex items-start justify-between gap-6 border-b pb-4" style={{ borderColor: primaryColor }}>
        <div className="flex min-w-0 items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="max-h-24 max-w-[310px] object-contain" />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[8px] text-xl font-semibold text-white" style={{ backgroundColor: primaryColor }}>
              {organizationName.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
        <div className="max-w-[250px] shrink-0 text-right text-[11px] leading-4 text-slate-700">
          {headerRightColumnMode === "CUSTOM" && clean(headerRightColumnHtml) ? (
            <div className="[&_p]:my-0 [&_strong]:font-semibold" dangerouslySetInnerHTML={{ __html: headerRightColumnHtml ?? "" }} />
          ) : headerRightLines.map((line, index) => <p key={`${line}-${index}`} className={usesRecipientHeader && index === 0 ? "font-semibold" : ""}>{line}</p>)}
        </div>
      </header>

      {!usesRecipientHeader ? (
        <section className="mt-5 grid grid-cols-[minmax(0,1fr)_auto] gap-6 text-[12px] leading-5 text-slate-800">
          <div>
            <p className="font-semibold" style={{ color: primaryColor }}>{recipientName}</p>
            {recipientAddress.map((line) => <p key={line}>{line}</p>)}
          </div>
          <p className="whitespace-nowrap text-right">{displayDate}</p>
        </section>
      ) : null}

      <section className="mt-5 flex-1 min-h-0 overflow-hidden text-[14px] leading-[18.5px] text-slate-950" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
        {displaySalutation ? <p className="mb-3">{displaySalutation}</p> : null}
        {bodySlot ?? (
          resolvedBodyHtml.trim()
            ? <div className="letter-page-body [&_h1]:my-[9px] [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:my-[9px] [&_h2]:text-lg [&_h2]:font-semibold [&_li]:my-[4px] [&_ol]:my-[9px] [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-[9px] [&_table]:my-0 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[12px] [&_table]:leading-[14.5px] [&_td]:border [&_td]:border-slate-300 [&_td]:p-2 [&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-50 [&_th]:p-2 [&_ul]:my-[9px] [&_ul]:list-disc [&_ul]:pl-6" dangerouslySetInnerHTML={{ __html: resolvedBodyHtml }} />
            : <p className="rounded-md border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">No document content available.</p>
        )}
      </section>

      {autoSignature ? (
        <section className="mt-5 text-sm leading-5 text-slate-900">
          <p>{closing}</p>
          {signatureUrl ? <img src={signatureUrl} alt="" className="mt-2 max-h-16 max-w-52 object-contain" /> : null}
          <p className="mt-2 font-semibold">{senderName}</p>
          {senderTitle ? <p className="text-slate-600">{senderTitle}</p> : null}
        </section>
      ) : null}

      {resolvedFooterEnabled ? (
        <footer className="mt-5 border-t pt-2" style={{ borderColor: accentColor }}>
          {resolvedBranding.footerLegalText ? <p className="text-center text-[10px] leading-4 text-slate-500">{resolvedBranding.footerLegalText}</p> : null}
          {displayFooterBlocks.length > 0 ? (
            <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-center text-[10px] leading-4 text-slate-600">
              {displayFooterBlocks.slice(0, 3).map((block) => (
                <p key={`${block.label}:${block.text}`} className="break-words"><span className="font-semibold" style={{ color: accentColor }}>{block.label}:</span> {block.text}</p>
              ))}
            </div>
          ) : null}
        </footer>
      ) : null}
    </article>
  );
}
