/**
 * Shared OyamaEmail renderer used by builder preview, publish, test-send, and campaign send.
 * Converts template JSON into final HTML and plain-text output.
 */

import { canonicalizeEmailMergeToken, extractEmailMergeTokens } from "./merge-field-catalog.js";

export type OyamaEmailBlockType =
  | "header"
  | "text"
  | "image"
  | "button"
  | "divider"
  | "spacer"
  | "columns"
  | "social"
  | "video"
  | "fileLink"
  | "donationButton"
  | "eventButton"
  | "html";

export interface OyamaEmailBlock {
  id: string;
  type: OyamaEmailBlockType;
  headerTitle?: string;
  headerSubtitle?: string;
  headerBackgroundColor?: string;
  logoUrl?: string;
  logoWidth?: number;
  align?: "left" | "center" | "right";
  paddingY?: number;
  content?: string;
  src?: string;
  alt?: string;
  imageWidthPercent?: number;
  imageLinkUrl?: string;
  label?: string;
  href?: string;
  color?: string;
  textColor?: string;
  thickness?: number;
  height?: number;
  leftHtml?: string;
  rightHtml?: string;
  /** Structured column stacks. Retains every builder block instead of flattening columns to rich text. */
  columns?: OyamaEmailBlock[][];
  links?: Array<{ label: string; url: string }>;
  socialMode?: "follow" | "share";
  socialLayout?: "row" | "column";
  socialIconStyle?: "pill" | "outline" | "plain";
  socialTrackingLabel?: string;
  socialShowLabels?: boolean;
  thumbnailUrl?: string;
  videoUrl?: string;
  videoTitle?: string;
  videoCtaLabel?: string;
  videoAlt?: string;
  videoFallbackText?: string;
  videoTrackingLabel?: string;
  caption?: string;
  fileLabel?: string;
  fileUrl?: string;
  fileDescription?: string;
  fileTrackingLabel?: string;
  html?: string;
  aiSmart?: boolean;
  aiSmartPrompt?: string;
  aiSmartTone?: "warm" | "urgent" | "celebratory" | "informative";
}

export interface OyamaEmailTemplateDocument {
  version: number;
  contentWidth: number;
  backgroundColor: string;
  fontFamily: string;
  baseFontSize: number;
  lineHeight: number;
  textColor: string;
  linkColor: string;
  blocks: OyamaEmailBlock[];
}

export interface OyamaEmailTemplateSettings {
  includeUnsubscribeLink: boolean;
  includePhysicalAddress: boolean;
  enablePlainTextVersion: boolean;
  physicalAddress: string;
  footerBrandingText: string;
  plainTextOverride?: string;
}

export interface RenderEmailTemplateResult {
  html: string;
  text: string;
  mergeFieldsUsed: string[];
}

const MERGE_FIELD_PATTERN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;
const SIMPLE_BRACE_FIELD_PATTERN = /(^|[^{])\{\s*([a-zA-Z][a-zA-Z0-9_.]*)\s*\}(?!\})/g;
const SLASH_FIELD_PATTERN = /(^|[\s([>])\/\/([a-zA-Z][a-zA-Z0-9_.]*)\b/g;

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  return value;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  return fallback;
}

function asNumber(value: unknown, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return numeric;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sanitizeFontFamily(value: unknown): string {
  const input = asString(value).trim();
  if (!input) return "Arial, Helvetica, sans-serif";
  if (!/^[a-zA-Z0-9\s,\-"']+$/.test(input)) return "Arial, Helvetica, sans-serif";
  return input;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeRichHtml(value: string): string {
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:(['\"]).*?\1|[^\s>]+)/gi, "");
}

function addDefaultInlineStyle(html: string, tag: string, defaultStyle: string): string {
  return html.replace(new RegExp(`<${tag}\\b([^>]*)>`, "gi"), (openingTag, attributes: string) => {
    const stylePattern = /\sstyle\s*=\s*(["'])(.*?)\1/i;
    if (stylePattern.test(attributes)) {
      return openingTag.replace(stylePattern, (_styleAttribute: string, quote: string, existingStyle: string) => (
        ` style=${quote}${defaultStyle}${existingStyle}${quote}`
      ));
    }
    return `<${tag}${attributes} style="${defaultStyle}">`;
  });
}

function formatEmailRichTextHtml(value: string, theme: RenderTheme): string {
  const textColor = escapeHtml(theme.textColor);
  const linkColor = escapeHtml(theme.linkColor);
  let html = sanitizeRichHtml(value);
  html = addDefaultInlineStyle(html, "p", "margin:0 0 0.95em 0;");
  html = addDefaultInlineStyle(html, "h1", `margin:0 0 0.55em 0;color:${textColor};font-size:${Math.max(theme.baseFontSize + 12, 28)}px;line-height:1.2;`);
  html = addDefaultInlineStyle(html, "h2", `margin:0 0 0.55em 0;color:${textColor};font-size:${Math.max(theme.baseFontSize + 8, 24)}px;line-height:1.24;`);
  html = addDefaultInlineStyle(html, "h3", `margin:0 0 0.55em 0;color:${textColor};font-size:${Math.max(theme.baseFontSize + 4, 20)}px;line-height:1.28;`);
  html = addDefaultInlineStyle(html, "ul", "display:block;list-style-type:disc;margin:0 0 0.95em 0;padding:0 0 0 26px;");
  html = addDefaultInlineStyle(html, "ol", "display:block;list-style-type:decimal;margin:0 0 0.95em 0;padding:0 0 0 26px;");
  html = addDefaultInlineStyle(html, "li", "display:list-item;margin:0 0 0.35em 0;padding:0;");
  html = addDefaultInlineStyle(html, "blockquote", "margin:0 0 0.95em 0;padding:0 0 0 14px;border-left:3px solid #cbd5e1;color:#475569;");
  return addDefaultInlineStyle(html, "a", `color:${linkColor};text-decoration:underline;`);
}

function nextId(index: number): string {
  return `block_${index + 1}`;
}

function normalizeLinks(raw: unknown): Array<{ label: string; url: string }> {
  if (!Array.isArray(raw)) return [];
  const normalized: Array<{ label: string; url: string }> = [];
  raw.forEach((row) => {
    const candidate = asObject(row);
    const label = asString(candidate.label).trim();
    const url = asString(candidate.url).trim();
    if (!url) return;
    normalized.push({ label: label || "Link", url });
  });
  return normalized.slice(0, 6);
}

function extractNestedText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((entry) => extractNestedText(entry)).filter(Boolean).join("\n");
  if (!value || typeof value !== "object") return "";
  return Object.values(value as Record<string, unknown>)
    .map((entry) => extractNestedText(entry))
    .filter(Boolean)
    .join("\n");
}

function normalizeLegacyAlign(value: unknown): "left" | "center" | "right" {
  const align = asString(value).trim().toLowerCase();
  if (align === "center" || align === "right") return align;
  return "left";
}

function paragraphHtml(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed
    .split(/\n{2,}/)
    .map((part) => `<p>${escapeHtml(part.trim()).replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

function legacyItems(raw: unknown): Record<string, unknown>[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => asObject(item)).filter((item) => Object.keys(item).length > 0);
}

function legacyListHtml(items: string[]): string {
  const rows = items.map((item) => item.trim()).filter(Boolean);
  if (rows.length === 0) return "";
  return `<ul style="margin:10px 0 0 20px;padding:0;">${rows.map((item) => `<li style="margin:0 0 6px;">${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function legacyStatsGridHtml(input: Record<string, unknown>, mode: "statistics" | "impactGrid"): string {
  const items = legacyItems(input.items);
  const title = escapeHtml(asString(input.title).trim());
  const intro = escapeHtml(asString(input.intro).trim());
  const bgColor = escapeHtml(asString(input.bgColor).trim() || "#f8fafc");
  const cardColor = escapeHtml(asString(input.cardColor).trim() || "#ffffff");
  const textColor = escapeHtml(asString(input.textColor).trim() || "#1f2937");
  const accentColor = escapeHtml(asString(input.accentColor).trim() || "#0f5c3c");
  const safeItems = items.length > 0 ? items : [
    { value: asString(input.value).trim(), label: asString(input.label).trim(), detail: asString(input.detail).trim() },
  ];

  const cells = safeItems
    .filter((item) => asString(item.value).trim() || asString(item.label).trim())
    .slice(0, 6)
    .map((item) => {
      const value = escapeHtml(asString(item.value).trim());
      const label = escapeHtml(asString(item.label).trim());
      const detail = escapeHtml(asString(item.detail).trim());
      return `
        <td valign="top" width="${mode === "statistics" ? "33.33%" : "50%"}" style="padding:6px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${cardColor};border:1px solid #dbe5df;border-radius:10px;">
            <tr>
              <td style="padding:14px;text-align:center;color:${textColor};">
                ${value ? `<div style="font-size:24px;line-height:1.15;font-weight:800;color:${accentColor};">${value}</div>` : ""}
                ${label ? `<div style="margin-top:4px;font-size:13px;line-height:1.35;font-weight:700;">${label}</div>` : ""}
                ${detail ? `<div style="margin-top:5px;font-size:12px;line-height:1.4;color:#64748b;">${detail}</div>` : ""}
              </td>
            </tr>
          </table>
        </td>`;
    });

  const rows: string[] = [];
  const perRow = mode === "statistics" ? 3 : 2;
  for (let index = 0; index < cells.length; index += perRow) {
    rows.push(`<tr>${cells.slice(index, index + perRow).join("")}</tr>`);
  }

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${bgColor};border-radius:12px;">
  <tr>
    <td style="padding:16px;">
      ${title ? `<div style="font-size:20px;line-height:1.25;font-weight:800;color:${textColor};">${title}</div>` : ""}
      ${intro ? `<div style="margin-top:6px;font-size:14px;line-height:1.5;color:${textColor};">${intro}</div>` : ""}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:${title || intro ? "10px" : "0"};">
        ${rows.join("")}
      </table>
    </td>
  </tr>
</table>`;
}

function legacyBlockToHtml(input: Record<string, unknown>, legacyType: string): string {
  const textColor = escapeHtml(asString(input.textColor).trim() || "#1f2937");
  const bgColor = escapeHtml(asString(input.bgColor).trim() || "#f8fafc");
  const borderColor = escapeHtml(asString(input.borderColor).trim() || "#dbe5df");
  const accentColor = escapeHtml(asString(input.accentColor).trim() || "#0f5c3c");
  const align = normalizeLegacyAlign(input.align);

  if (legacyType === "heading") {
    const eyebrow = escapeHtml(asString(input.eyebrow).trim());
    const title = escapeHtml(asString(input.title).trim());
    const subtitle = escapeHtml(asString(input.subtitle).trim());
    return `
<div style="text-align:${align};color:${textColor};">
  ${eyebrow ? `<div style="font-size:12px;line-height:1.4;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${accentColor};">${eyebrow}</div>` : ""}
  ${title ? `<h2 style="margin:4px 0 0;font-size:26px;line-height:1.22;color:${textColor};">${title}</h2>` : ""}
  ${subtitle ? `<p style="margin:8px 0 0;font-size:15px;line-height:1.55;color:${textColor};">${subtitle}</p>` : ""}
</div>`;
  }

  if (legacyType === "quote") {
    const quote = escapeHtml(asString(input.quote).trim());
    const attribution = escapeHtml(asString(input.attribution).trim());
    return `
<blockquote style="margin:0;padding:12px 16px;border-left:4px solid ${accentColor};background:#f8fafc;color:${textColor};">
  <p style="margin:0;font-size:18px;line-height:1.5;font-style:italic;">${quote || "Quote text"}</p>
  ${attribution ? `<p style="margin:8px 0 0;font-size:13px;font-weight:700;">${attribution}</p>` : ""}
</blockquote>`;
  }

  if (legacyType === "impactStat") {
    const value = escapeHtml(asString(input.value).trim());
    const label = escapeHtml(asString(input.label).trim());
    const sublabel = escapeHtml(asString(input.sublabel).trim() || asString(input.timePeriod).trim());
    return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${bgColor};border:1px solid ${borderColor};border-radius:12px;">
  <tr>
    <td style="padding:18px;text-align:center;color:${textColor};">
      ${value ? `<div style="font-size:34px;line-height:1.1;font-weight:800;color:${accentColor};">${value}</div>` : ""}
      ${label ? `<div style="margin-top:6px;font-size:15px;font-weight:700;">${label}</div>` : ""}
      ${sublabel ? `<div style="margin-top:5px;font-size:12px;color:#64748b;">${sublabel}</div>` : ""}
    </td>
  </tr>
</table>`;
  }

  if (legacyType === "statistics" || legacyType === "impactGrid") {
    return legacyStatsGridHtml(input, legacyType);
  }

  if (legacyType === "callout") {
    const title = escapeHtml(asString(input.title).trim());
    const body = asString(input.body).trim();
    return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${bgColor};border:1px solid ${borderColor};border-radius:12px;">
  <tr>
    <td style="padding:16px;color:${textColor};">
      ${title ? `<div style="font-size:18px;line-height:1.3;font-weight:800;">${title}</div>` : ""}
      <div style="${title ? "margin-top:8px;" : ""}font-size:14px;line-height:1.55;">${paragraphHtml(body) || "<p>Add callout text.</p>"}</div>
    </td>
  </tr>
</table>`;
  }

  if (legacyType === "featureList") {
    const title = escapeHtml(asString(input.title).trim());
    const dollarFraming = escapeHtml(asString(input.dollarFraming).trim());
    const items = Array.isArray(input.items) ? input.items.map((item) => asString(item)) : [];
    return `
<div style="color:${textColor};">
  ${title ? `<h3 style="margin:0;font-size:20px;line-height:1.3;color:${textColor};">${title}</h3>` : ""}
  ${dollarFraming ? `<div style="margin-top:6px;font-size:13px;font-weight:700;color:${accentColor};">${dollarFraming}</div>` : ""}
  ${legacyListHtml(items) || "<p>Add list items.</p>"}
</div>`;
  }

  if (legacyType === "timeline") {
    const title = escapeHtml(asString(input.title).trim());
    const items = legacyItems(input.items)
      .map((item) => {
        const itemTitle = escapeHtml(asString(item.title).trim());
        const detail = escapeHtml(asString(item.detail).trim());
        if (!itemTitle && !detail) return "";
        return `<tr><td valign="top" style="width:18px;color:${accentColor};font-weight:800;">•</td><td style="padding:0 0 10px;color:${textColor};">${itemTitle ? `<strong>${itemTitle}</strong>` : ""}${detail ? `<div style="font-size:13px;line-height:1.45;color:#64748b;">${detail}</div>` : ""}</td></tr>`;
      })
      .filter(Boolean)
      .join("");
    return `
<div style="color:${textColor};">
  ${title ? `<h3 style="margin:0 0 10px;font-size:20px;line-height:1.3;color:${textColor};">${title}</h3>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${items || "<tr><td>Add timeline items.</td></tr>"}</table>
</div>`;
  }

  if (legacyType === "progress") {
    const label = escapeHtml(asString(input.label).trim() || "Progress");
    const current = asNumber(input.current, 0);
    const goal = asNumber(input.goal, 0);
    const percent = goal > 0 ? clamp(Math.round((current / goal) * 100), 0, 100) : 0;
    const barColor = escapeHtml(asString(input.barColor).trim() || accentColor);
    const trackColor = escapeHtml(asString(input.trackColor).trim() || "#e2e8f0");
    return `
<div style="color:${textColor};">
  <div style="font-size:14px;font-weight:800;">${label}</div>
  <div style="margin-top:8px;height:10px;background:${trackColor};border-radius:999px;overflow:hidden;"><div style="width:${percent}%;height:10px;background:${barColor};"></div></div>
  <div style="margin-top:6px;font-size:12px;color:#64748b;">${escapeHtml(String(current))} of ${escapeHtml(String(goal))} (${percent}%)</div>
</div>`;
  }

  if (legacyType === "donationCta") {
    const headline = escapeHtml(asString(input.headline).trim());
    const appealText = asString(input.appealText).trim();
    const buttonLabel = asString(input.buttonLabel).trim() || "Donate Now";
    const buttonUrl = asString(input.buttonUrl).trim();
    return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${bgColor};border-radius:12px;">
  <tr>
    <td style="padding:18px;text-align:center;color:${textColor};">
      ${headline ? `<h2 style="margin:0;font-size:24px;line-height:1.25;color:${textColor};">${headline}</h2>` : ""}
      ${appealText ? `<div style="margin-top:8px;font-size:14px;line-height:1.55;">${paragraphHtml(appealText)}</div>` : ""}
      <div style="margin-top:14px;"><a href="${escapeHtml(buttonUrl || "#")}" style="display:inline-block;background:${accentColor};color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:800;">${escapeHtml(buttonLabel)}</a></div>
    </td>
  </tr>
</table>`;
  }

  if (legacyType === "eventDetails") {
    const title = escapeHtml(asString(input.title).trim() || asString(input.eventName).trim() || "Event Details");
    const date = escapeHtml(asString(input.date).trim() || asString(input.eventDate).trim() || "{{event.startDate}}");
    const time = escapeHtml(asString(input.time).trim() || asString(input.eventTime).trim());
    const location = escapeHtml(asString(input.location).trim() || asString(input.eventLocation).trim() || "{{event.location}}");
    const body = asString(input.body).trim() || asString(input.description).trim();
    return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${bgColor};border:1px solid ${borderColor};border-radius:12px;">
  <tr>
    <td style="padding:16px;color:${textColor};">
      <div style="font-size:20px;font-weight:800;line-height:1.3;">${title}</div>
      <div style="margin-top:8px;font-size:14px;line-height:1.55;">
        <div><strong>Date:</strong> ${date}</div>
        ${time ? `<div><strong>Time:</strong> ${time}</div>` : ""}
        <div><strong>Location:</strong> ${location}</div>
      </div>
      ${body ? `<div style="margin-top:10px;font-size:14px;line-height:1.55;">${paragraphHtml(body)}</div>` : ""}
    </td>
  </tr>
</table>`;
  }

  if (legacyType === "contactCard") {
    const name = escapeHtml(asString(input.name).trim() || asString(input.contactName).trim() || "{{staffName}}");
    const title = escapeHtml(asString(input.title).trim() || asString(input.contactTitle).trim() || "{{staffTitle}}");
    const email = escapeHtml(asString(input.email).trim() || asString(input.contactEmail).trim() || "{{staffEmail}}");
    const phone = escapeHtml(asString(input.phone).trim() || asString(input.contactPhone).trim());
    return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${borderColor};border-radius:12px;background:#ffffff;">
  <tr>
    <td style="padding:16px;color:${textColor};">
      <div style="font-size:16px;font-weight:800;">${name}</div>
      ${title ? `<div style="margin-top:2px;font-size:13px;color:#64748b;">${title}</div>` : ""}
      <div style="margin-top:10px;font-size:13px;line-height:1.5;">${email ? `<div><a href="mailto:${email}" style="color:${accentColor};">${email}</a></div>` : ""}${phone ? `<div>${phone}</div>` : ""}</div>
    </td>
  </tr>
</table>`;
  }

  if (legacyType === "staffSignature") {
    const name = escapeHtml(asString(input.name).trim() || asString(input.signatureName).trim() || "{{signatureName}}");
    const title = escapeHtml(asString(input.title).trim() || asString(input.staffTitle).trim());
    const message = asString(input.message).trim() || asString(input.signoff).trim();
    return `<div style="color:${textColor};">${message ? paragraphHtml(message) : "<p>With gratitude,</p>"}<p style="margin-top:12px;"><strong>${name}</strong>${title ? `<br/>${title}` : ""}</p></div>`;
  }

  if (legacyType === "partnerLogos") {
    const title = escapeHtml(asString(input.title).trim());
    const logos = legacyItems(input.logos)
      .map((logo) => {
        const src = asString(logo.src).trim() || asString(logo.url).trim();
        const alt = escapeHtml(asString(logo.alt).trim() || asString(logo.name).trim() || "Partner logo");
        if (!src) return "";
        return `<td style="padding:8px;text-align:center;"><img src="${escapeHtml(src)}" alt="${alt}" style="max-width:120px;max-height:54px;height:auto;width:auto;" /></td>`;
      })
      .filter(Boolean)
      .join("");
    return `<div style="text-align:center;color:${textColor};">${title ? `<div style="font-size:14px;font-weight:800;margin-bottom:8px;">${title}</div>` : ""}<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0"><tr>${logos || "<td>Add partner logos.</td>"}</tr></table></div>`;
  }

  if (legacyType === "footerCompliance") {
    const text = asString(input.text).trim() || asString(input.body).trim() || "Manage communication settings: {{managePreferencesUrl}}. Unsubscribe: {{unsubscribeUrl}}.";
    return `<div style="font-size:12px;line-height:1.5;color:#64748b;text-align:center;">${paragraphHtml(text)}</div>`;
  }

  return paragraphHtml(extractNestedText(input)) || "<p>Legacy content block</p>";
}

function normalizeBlock(raw: unknown, index: number, depth = 0): OyamaEmailBlock {
  const input = asObject(raw);
  const legacyType = asString(input.type).trim();
  const mappedType = legacyType === "customHtml"
    ? "html"
    : legacyType === "aiText"
      ? "text"
      : legacyType === "aiButton"
        ? "button"
        : legacyType;
  const supported: OyamaEmailBlockType[] = [
    "header",
    "text",
    "image",
    "button",
    "divider",
    "spacer",
    "columns",
    "social",
    "video",
    "fileLink",
    "donationButton",
    "eventButton",
    "html",
  ];

  const type = supported.includes(mappedType as OyamaEmailBlockType)
    ? (mappedType as OyamaEmailBlockType)
    : "text";

  const id = asString(input.id).trim() || nextId(index);

  if (!supported.includes(mappedType as OyamaEmailBlockType)) {
    return {
      id,
      type: "html",
      html: legacyBlockToHtml(input, legacyType),
    };
  }

  if (type === "header") {
    const alignRaw = asString(input.align).trim().toLowerCase();
    const align = alignRaw === "left" || alignRaw === "right" ? alignRaw : "center";
    return {
      id,
      type,
      headerTitle: asString(input.headerTitle).trim() || "Your Organization",
      headerSubtitle: asString(input.headerSubtitle).trim(),
      headerBackgroundColor: asString(input.headerBackgroundColor).trim() || "#0f5c3c",
      logoUrl: asString(input.logoUrl).trim(),
      logoWidth: clamp(asNumber(input.logoWidth, 140), 60, 260),
      align,
      paddingY: clamp(asNumber(input.paddingY, 20), 8, 56),
    };
  }

  if (type === "text") {
    if (Object.prototype.hasOwnProperty.call(input, "content")) {
      return { id, type, content: asString(input.content) };
    }
    const fallback = extractNestedText(input);
    return { id, type, content: fallback ? paragraphHtml(fallback) : "" };
  }

  if (type === "image") {
    const alignRaw = asString(input.align).trim().toLowerCase();
    const align = alignRaw === "left" || alignRaw === "right" ? alignRaw : "center";
    return {
      id,
      type,
      src: asString(input.src).trim(),
      alt: asString(input.alt).trim(),
      imageWidthPercent: clamp(asNumber(input.imageWidthPercent, asNumber(input.width, 100)), 20, 100),
      imageLinkUrl: asString(input.imageLinkUrl).trim() || asString(input.link).trim(),
      caption: asString(input.caption).trim(),
      align,
    };
  }

  if (type === "button" || type === "donationButton" || type === "eventButton") {
    return {
      id,
      type,
      label: asString(input.label).trim() || asString(input.buttonLabel).trim() || "Learn More",
      href: asString(input.href).trim() || asString(input.buttonUrl).trim() || "",
      color: asString(input.color).trim() || asString(input.bgColor).trim() || "#0f5c3c",
      textColor: asString(input.textColor).trim() || asString(input.buttonTextColor).trim() || "#ffffff",
    };
  }

  if (type === "divider") {
    return {
      id,
      type,
      color: asString(input.color).trim() || "#d7e0dc",
      thickness: clamp(asNumber(input.thickness, 1), 1, 8),
    };
  }

  if (type === "spacer") {
    return {
      id,
      type,
      height: clamp(asNumber(input.height, 24), 4, 160),
    };
  }

  if (type === "columns") {
    const structuredColumns = Array.isArray(input.columns) && depth < 3
      ? input.columns.slice(0, 2).map((column, columnIndex) => Array.isArray(column)
        ? column.slice(0, 24).map((item, itemIndex) => normalizeBlock(item, (index + 1) * 1000 + columnIndex * 100 + itemIndex, depth + 1))
        : [])
      : [];
    if (structuredColumns.some((column) => column.length > 0)) {
      return {
        id,
        type,
        columns: [structuredColumns[0] || [], structuredColumns[1] || []],
      };
    }
    const leftHtml = asString(input.leftHtml).trim();
    const rightHtml = asString(input.rightHtml).trim();
    if (leftHtml || rightHtml) {
      return {
        id,
        type,
        leftHtml: leftHtml || "<p>Add left column content.</p>",
        rightHtml: rightHtml || "<p>Add right column content.</p>",
      };
    }

    const legacyColumns = Array.isArray(input.columns) ? input.columns : [];
    const leftLegacy = extractNestedText(legacyColumns[0]);
    const rightLegacy = extractNestedText(legacyColumns[1]);

    return {
      id,
      type,
      leftHtml: leftLegacy ? `<p>${escapeHtml(leftLegacy)}</p>` : "<p>Add left column content.</p>",
      rightHtml: rightLegacy ? `<p>${escapeHtml(rightLegacy)}</p>` : "<p>Add right column content.</p>",
    };
  }

  if (type === "social") {
    return {
      id,
      type,
      links: normalizeLinks(input.links),
      socialMode: asString(input.socialMode).trim().toLowerCase() === "share" ? "share" : "follow",
      socialLayout: asString(input.socialLayout).trim().toLowerCase() === "column" ? "column" : "row",
      socialIconStyle: asString(input.socialIconStyle).trim().toLowerCase() === "outline"
        ? "outline"
        : asString(input.socialIconStyle).trim().toLowerCase() === "plain"
          ? "plain"
          : "pill",
      socialTrackingLabel: asString(input.socialTrackingLabel).trim(),
      socialShowLabels: asBoolean(input.socialShowLabels, true),
    };
  }

  if (type === "video") {
    return {
      id,
      type,
      thumbnailUrl: asString(input.thumbnailUrl).trim(),
      videoUrl: asString(input.videoUrl).trim() || asString(input.url).trim(),
      videoTitle: asString(input.videoTitle).trim(),
      videoCtaLabel: asString(input.videoCtaLabel).trim() || "Watch Video",
      videoAlt: asString(input.videoAlt).trim() || "Video thumbnail",
      videoFallbackText: asString(input.videoFallbackText).trim(),
      videoTrackingLabel: asString(input.videoTrackingLabel).trim(),
      caption: asString(input.caption).trim(),
    };
  }

  if (type === "fileLink") {
    return {
      id,
      type,
      fileLabel: asString(input.fileLabel).trim() || "Download Resource",
      fileUrl: asString(input.fileUrl).trim(),
      fileDescription: asString(input.fileDescription).trim(),
      fileTrackingLabel: asString(input.fileTrackingLabel).trim(),
    };
  }

  return {
    id,
    type: "html",
    html: asString(input.html).trim() || asString(input.content).trim() || "<p>Custom HTML block</p>",
    aiSmart: asBoolean(input.aiSmart, false),
    aiSmartPrompt: asString(input.aiSmartPrompt).trim(),
    aiSmartTone: asString(input.aiSmartTone).trim().toLowerCase() === "urgent"
      ? "urgent"
      : asString(input.aiSmartTone).trim().toLowerCase() === "celebratory"
        ? "celebratory"
        : asString(input.aiSmartTone).trim().toLowerCase() === "informative"
          ? "informative"
          : "warm",
  };
}

export function createDefaultEmailTemplateDocument(): OyamaEmailTemplateDocument {
  return {
    version: 1,
    contentWidth: 600,
    backgroundColor: "#f3f7f5",
    fontFamily: "Arial, Helvetica, sans-serif",
    baseFontSize: 16,
    lineHeight: 1.6,
    textColor: "#1f2937",
    linkColor: "#0f5c3c",
    blocks: [
      {
        id: "block_1",
        type: "text",
        content: "",
      },
    ],
  };
}

export function normalizeEmailTemplateDocument(raw: unknown): OyamaEmailTemplateDocument {
  const input = asObject(raw);
  const blocksInput = Array.isArray(input.blocks) ? input.blocks : [];
  const blocks = blocksInput.map((row, index) => normalizeBlock(row, index));

  if (blocks.length === 0) {
    return createDefaultEmailTemplateDocument();
  }

  return {
    version: 1,
    contentWidth: clamp(asNumber(input.contentWidth, 600), 420, 760),
    backgroundColor: asString(input.backgroundColor).trim() || "#f3f7f5",
    fontFamily: sanitizeFontFamily(input.fontFamily),
    baseFontSize: clamp(asNumber(input.baseFontSize, 16), 12, 22),
    lineHeight: clamp(asNumber(input.lineHeight, 1.6), 1.2, 2.2),
    textColor: asString(input.textColor).trim() || "#1f2937",
    linkColor: asString(input.linkColor).trim() || "#0f5c3c",
    blocks,
  };
}

export function normalizeEmailTemplateSettings(raw: unknown): OyamaEmailTemplateSettings {
  const input = asObject(raw);
  return {
    includeUnsubscribeLink: asBoolean(input.includeUnsubscribeLink, true),
    includePhysicalAddress: asBoolean(input.includePhysicalAddress, true),
    enablePlainTextVersion: asBoolean(input.enablePlainTextVersion, true),
    physicalAddress: asString(input.physicalAddress).trim(),
    footerBrandingText: asString(input.footerBrandingText).trim(),
    plainTextOverride: asString(input.plainTextOverride).trim(),
  };
}

interface RenderTheme {
  fontFamily: string;
  baseFontSize: number;
  lineHeight: number;
  textColor: string;
  linkColor: string;
}

export type OyamaEmailGlobalChrome = {
  organizationName?: string;
  legalOrganizationName?: string;
  tagline?: string;
  logoUrl?: string;
  logoSquareUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  emailBackgroundColor?: string;
  emailFontFamily?: string;
  emailContentWidth?: number;
  contactEmail?: string;
  contactPhone?: string;
  websiteUrl?: string;
  addressLine?: string;
  footerLegalText?: string;
  globalHeaderHtml?: string;
  globalFooterHtml?: string;
  /** Public CRM origin used for relative uploaded images in delivered email. */
  publicAssetBaseUrl?: string;
};

function resolvePublicEmailAssetUrl(value: string, publicAssetBaseUrl: string): string {
  const candidate = value.trim();
  if (!candidate || candidate.startsWith("#") || candidate.includes("{{") || candidate.includes("}}")) return value;
  if (/^https?:\/\//i.test(candidate)) return value;
  if (/^[a-z][a-z0-9+.-]*:/i.test(candidate)) return value;

  try {
    return new URL(candidate, `${publicAssetBaseUrl.replace(/\/+$/, "")}/`).toString();
  } catch {
    return value;
  }
}

/** Converts stored relative image attributes into absolute public URLs that inbox clients can request. */
export function absolutizeEmailAssetUrls(html: string, publicAssetBaseUrl?: string): string {
  const configuredBase = String(publicAssetBaseUrl || "").trim();
  if (!configuredBase) return html;

  try {
    const parsed = new URL(configuredBase);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return html;
  } catch {
    return html;
  }

  return html.replace(
    /\b(src|poster|background)\s*=\s*(["'])(.*?)\2/gi,
    (_attribute, name: string, quote: string, value: string) => (
      `${name}=${quote}${resolvePublicEmailAssetUrl(value, configuredBase)}${quote}`
    ),
  );
}

function themeFromTemplate(template: OyamaEmailTemplateDocument): RenderTheme {
  return {
    fontFamily: sanitizeFontFamily(template.fontFamily),
    baseFontSize: clamp(asNumber(template.baseFontSize, 16), 12, 22),
    lineHeight: clamp(asNumber(template.lineHeight, 1.6), 1.2, 2.2),
    textColor: asString(template.textColor).trim() || "#1f2937",
    linkColor: asString(template.linkColor).trim() || "#0f5c3c",
  };
}

function renderTextBlock(block: OyamaEmailBlock, theme: RenderTheme): string {
  const html = formatEmailRichTextHtml(asString(block.content), theme);
  return `
<tr>
  <td style="padding:14px 24px;font-family:${escapeHtml(theme.fontFamily)};font-size:${theme.baseFontSize}px;line-height:${theme.lineHeight};color:${escapeHtml(theme.textColor)};">
    ${html}
  </td>
</tr>`;
}

function renderHeaderBlock(block: OyamaEmailBlock, theme: RenderTheme): string {
  const title = escapeHtml(asString(block.headerTitle).trim() || "Your Organization");
  const subtitle = escapeHtml(asString(block.headerSubtitle).trim());
  const bg = escapeHtml(asString(block.headerBackgroundColor).trim() || "#0f5c3c");
  const logoUrl = asString(block.logoUrl).trim();
  const logoWidth = clamp(asNumber(block.logoWidth, 140), 60, 260);
  const align = block.align === "left" || block.align === "right" ? block.align : "center";
  const paddingY = clamp(asNumber(block.paddingY, 20), 8, 56);

  const logoHtml = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="Organization logo" style="display:block;width:${logoWidth}px;max-width:100%;height:auto;margin:${align === "center" ? "0 auto" : align === "right" ? "0 0 0 auto" : "0"};" />`
    : "";

  return `
<tr>
  <td style="padding:${paddingY}px 24px;background:${bg};text-align:${align};font-family:${escapeHtml(theme.fontFamily)};">
    ${logoHtml ? `<div style=\"margin-bottom:10px;\">${logoHtml}</div>` : ""}
    <div style="font-size:${Math.max(theme.baseFontSize + 8, 24)}px;line-height:1.2;font-weight:700;color:#ffffff;">${title}</div>
    ${subtitle ? `<div style=\"margin-top:6px;font-size:${Math.max(theme.baseFontSize - 1, 12)}px;line-height:1.5;color:#ecfdf5;\">${subtitle}</div>` : ""}
  </td>
</tr>`;
}

function renderImageBlock(block: OyamaEmailBlock): string {
  const src = asString(block.src).trim();
  if (!src) {
    return `
<tr>
  <td style="padding:14px 24px;">
    <div style="border:1px dashed #cbd5e1;border-radius:10px;padding:18px;text-align:center;font-family:Arial,Helvetica,sans-serif;color:#64748b;">Image block has no source URL.</div>
  </td>
</tr>`;
  }

  const alt = escapeHtml(asString(block.alt).trim() || "Email image");
  const widthPercent = clamp(asNumber(block.imageWidthPercent, 100), 20, 100);
  const align = block.align === "left" || block.align === "right" ? block.align : "center";
  const margin = align === "left" ? "0 auto 0 0" : align === "right" ? "0 0 0 auto" : "0 auto";
  const image = `<img src="${escapeHtml(src)}" alt="${alt}" width="${widthPercent}%" style="width:${widthPercent}%;max-width:100%;height:auto;border-radius:10px;display:block;margin:${margin};border:0;" />`;
  const linkUrl = asString(block.imageLinkUrl).trim();
  const imageHtml = linkUrl ? `<a href="${escapeHtml(linkUrl)}" style="text-decoration:none;">${image}</a>` : image;
  const caption = asString(block.caption).trim();
  return `
<tr>
  <td style="padding:14px 24px;text-align:center;">
    ${imageHtml}
    ${caption ? `<div style="margin-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.4;color:#64748b;text-align:center;">${escapeHtml(caption)}</div>` : ""}
  </td>
</tr>`;
}

function renderButtonBlock(block: OyamaEmailBlock): string {
  const label = escapeHtml(asString(block.label).trim() || "Open Link");
  const href = escapeHtml(asString(block.href).trim() || "#");
  const color = escapeHtml(asString(block.color).trim() || "#0f5c3c");
  const textColor = escapeHtml(asString(block.textColor).trim() || "#ffffff");

  return `
<tr>
  <td style="padding:14px 24px;text-align:center;">
    <a href="${href}" style="display:inline-block;background:${color};color:${textColor};padding:12px 20px;border-radius:8px;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;">${label}</a>
  </td>
</tr>`;
}

function renderDividerBlock(block: OyamaEmailBlock): string {
  const color = escapeHtml(asString(block.color).trim() || "#d7e0dc");
  const thickness = clamp(asNumber(block.thickness, 1), 1, 8);
  return `
<tr>
  <td style="padding:12px 24px;">
    <hr style="margin:0;border:0;border-top:${thickness}px solid ${color};" />
  </td>
</tr>`;
}

function renderSpacerBlock(block: OyamaEmailBlock): string {
  const height = clamp(asNumber(block.height, 24), 4, 160);
  return `
<tr>
  <td style="height:${height}px;line-height:${height}px;font-size:${height}px;">&nbsp;</td>
</tr>`;
}

function renderColumnBlock(block: OyamaEmailBlock, theme: RenderTheme, depth = 0): string {
  if (block.type === "text") return formatEmailRichTextHtml(asString(block.content), theme);
  if (block.type === "html") return formatEmailRichTextHtml(asString(block.html), theme);
  if (block.type === "image") {
    const src = escapeHtml(asString(block.src).trim());
    const image = src ? `<img src="${src}" alt="${escapeHtml(asString(block.alt).trim() || "Image")}" style="max-width:100%;height:auto;display:block;margin:0 auto;border-radius:8px;" />` : "<div style='border:1px dashed #94a3b8;padding:12px;color:#64748b;'>Image source not set</div>";
    return `<div style="margin:10px 0;text-align:${block.align || "center"};">${block.imageLinkUrl ? `<a href="${escapeHtml(asString(block.imageLinkUrl))}">${image}</a>` : image}${block.caption ? `<div style="margin-top:6px;font-size:12px;color:#64748b;">${escapeHtml(block.caption)}</div>` : ""}</div>`;
  }
  if (block.type === "button" || block.type === "donationButton" || block.type === "eventButton") return `<div style="margin:12px 0;text-align:center;"><a href="${escapeHtml(asString(block.href).trim() || "#")}" style="display:inline-block;background:${escapeHtml(asString(block.color).trim() || "#0f5c3c")};color:${escapeHtml(asString(block.textColor).trim() || "#ffffff")};padding:10px 14px;border-radius:7px;text-decoration:none;font-family:${escapeHtml(theme.fontFamily)};font-size:14px;font-weight:700;">${escapeHtml(asString(block.label).trim() || "Open Link")}</a></div>`;
  if (block.type === "divider") return `<hr style="margin:12px 0;border:0;border-top:${clamp(asNumber(block.thickness, 1), 1, 8)}px solid ${escapeHtml(asString(block.color).trim() || "#d7e0dc")};" />`;
  if (block.type === "spacer") return `<div style="height:${clamp(asNumber(block.height, 24), 4, 160)}px;line-height:1px;">&nbsp;</div>`;
  if (block.type === "columns") return renderColumnsBlock(block, theme, depth + 1);
  if (block.type === "header") return `<div style="margin:8px 0;padding:${clamp(asNumber(block.paddingY, 16), 8, 56)}px 12px;background:${escapeHtml(asString(block.headerBackgroundColor).trim() || "#0f5c3c")};color:#fff;text-align:${block.align || "center"};border-radius:8px;"><strong>${escapeHtml(asString(block.headerTitle).trim() || "Your Organization")}</strong>${block.headerSubtitle ? `<div style="margin-top:4px;font-size:13px;">${escapeHtml(block.headerSubtitle)}</div>` : ""}</div>`;
  if (block.type === "video") return `<div style="margin:10px 0;text-align:center;">${block.thumbnailUrl ? `<a href="${escapeHtml(asString(block.videoUrl).trim() || "#")}"><img src="${escapeHtml(block.thumbnailUrl)}" alt="${escapeHtml(asString(block.videoAlt).trim() || "Video thumbnail")}" style="max-width:100%;height:auto;border-radius:8px;" /></a>` : `<a href="${escapeHtml(asString(block.videoUrl).trim() || "#")}">${escapeHtml(asString(block.videoCtaLabel).trim() || "Watch Video")}</a>`}</div>`;
  if (block.type === "fileLink") return `<p><a href="${escapeHtml(asString(block.fileUrl).trim() || "#")}" style="color:${escapeHtml(theme.linkColor)};font-weight:700;">${escapeHtml(asString(block.fileLabel).trim() || "Download Resource")}</a>${block.fileDescription ? `<br/><span style="font-size:12px;color:#64748b;">${escapeHtml(block.fileDescription)}</span>` : ""}</p>`;
  if (block.type === "social") return `<p style="text-align:center;">${(block.links || []).map((link) => `<a href="${escapeHtml(link.url || "#")}" style="color:${escapeHtml(theme.linkColor)};margin:0 4px;">${escapeHtml(link.label || "Link")}</a>`).join("")}</p>`;
  return "";
}

function renderColumnsBlock(block: OyamaEmailBlock, theme: RenderTheme, depth = 0): string {
  const structured = depth < 3 && Array.isArray(block.columns)
    ? [block.columns[0] || [], block.columns[1] || []]
    : null;
  const left = structured
    ? structured[0].map((item) => renderColumnBlock(item, theme, depth)).join("") || "<p>Add left column content.</p>"
    : formatEmailRichTextHtml(asString(block.leftHtml).trim() || "<p>Add left column content.</p>", theme);
  const right = structured
    ? structured[1].map((item) => renderColumnBlock(item, theme, depth)).join("") || "<p>Add right column content.</p>"
    : formatEmailRichTextHtml(asString(block.rightHtml).trim() || "<p>Add right column content.</p>", theme);

  return `
<tr>
  <td style="padding:14px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td width="50%" valign="top" style="padding:0 8px 0 0;font-family:${escapeHtml(theme.fontFamily)};font-size:${Math.max(12, theme.baseFontSize - 1)}px;line-height:${theme.lineHeight};color:${escapeHtml(theme.textColor)};">${left}</td>
        <td width="50%" valign="top" style="padding:0 0 0 8px;font-family:${escapeHtml(theme.fontFamily)};font-size:${Math.max(12, theme.baseFontSize - 1)}px;line-height:${theme.lineHeight};color:${escapeHtml(theme.textColor)};">${right}</td>
      </tr>
    </table>
  </td>
</tr>`;
}

function renderSocialBlock(block: OyamaEmailBlock, theme: RenderTheme): string {
  const links = Array.isArray(block.links) ? block.links : [];
  const mode = block.socialMode === "share" ? "share" : "follow";
  const layout = block.socialLayout === "column" ? "column" : "row";
  const style = block.socialIconStyle === "outline"
    ? "outline"
    : block.socialIconStyle === "plain"
      ? "plain"
      : "pill";
  const showLabels = block.socialShowLabels !== false;

  if (links.length === 0) {
    return `
<tr>
  <td style="padding:14px 24px;font-family:${escapeHtml(theme.fontFamily)};font-size:${Math.max(12, theme.baseFontSize - 2)}px;line-height:${theme.lineHeight};color:#64748b;text-align:center;">Add social links in the builder inspector.</td>
</tr>`;
  }

  const linkHtml = links
    .slice(0, 6)
    .map((link) => {
      const label = escapeHtml(link.label || "Link");
      const url = escapeHtml(link.url || "#");
      const content = showLabels ? label : "●";
      const styleTokens = style === "outline"
        ? `display:inline-block;margin:4px 6px;padding:6px 10px;border-radius:999px;border:1px solid ${escapeHtml(theme.linkColor)};color:${escapeHtml(theme.linkColor)};text-decoration:none;`
        : style === "plain"
          ? `display:inline-block;margin:4px 6px;color:${escapeHtml(theme.linkColor)};text-decoration:none;`
          : `display:inline-block;margin:4px 6px;padding:6px 10px;border-radius:999px;background:#ecfdf5;border:1px solid #bbf7d0;color:${escapeHtml(theme.linkColor)};text-decoration:none;`;
      return `<a href="${url}" style="${styleTokens}font-family:${escapeHtml(theme.fontFamily)};font-size:${Math.max(12, theme.baseFontSize - 2)}px;font-weight:700;">${content}</a>`;
    })
    .join("");

  const heading = mode === "share" ? "Share this campaign" : "Follow us";

  return `
<tr>
  <td style="padding:14px 24px;text-align:center;">
    <div style="margin-bottom:6px;font-family:${escapeHtml(theme.fontFamily)};font-size:${Math.max(10, theme.baseFontSize - 4)}px;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;">${heading}</div>
    ${layout === "column" ? `<div>${linkHtml.split("</a>").filter(Boolean).map((entry) => `${entry}</a><br/>`).join("")}</div>` : linkHtml}
  </td>
</tr>`;
}

function renderVideoBlock(block: OyamaEmailBlock, theme: RenderTheme): string {
  const thumbnailUrl = asString(block.thumbnailUrl).trim();
  const videoUrl = asString(block.videoUrl).trim();
  const videoTitle = escapeHtml(asString(block.videoTitle).trim());
  const videoCtaLabel = escapeHtml(asString(block.videoCtaLabel).trim() || "Watch Video");
  const videoAlt = escapeHtml(asString(block.videoAlt).trim() || "Video thumbnail");
  const fallbackText = escapeHtml(asString(block.videoFallbackText).trim());
  const caption = escapeHtml(asString(block.caption).trim());

  const imageHtml = thumbnailUrl
    ? `<img src="${escapeHtml(thumbnailUrl)}" alt="${videoAlt}" style="max-width:100%;height:auto;border-radius:10px;display:block;margin:0 auto;" />`
    : "<div style='border:1px dashed #f59e0b;background:#fffbeb;border-radius:10px;padding:18px;color:#92400e;'>Add a thumbnail URL for this video before sending.</div>";

  const wrapped = videoUrl
    ? `<a href="${escapeHtml(videoUrl)}" style="text-decoration:none;">${imageHtml}</a>`
    : imageHtml;

  const ctaHtml = videoUrl
    ? `<div style="margin-top:10px;"><a href="${escapeHtml(videoUrl)}" style="display:inline-block;background:#0f5c3c;color:#ffffff;padding:10px 16px;border-radius:8px;text-decoration:none;font-family:${escapeHtml(theme.fontFamily)};font-size:${Math.max(12, theme.baseFontSize - 2)}px;font-weight:700;">${videoCtaLabel}</a></div>`
    : "";

  const captionHtml = caption
    ? `<div style="margin-top:8px;font-family:${escapeHtml(theme.fontFamily)};font-size:${Math.max(11, theme.baseFontSize - 3)}px;color:#64748b;">${caption}</div>`
    : "";

  const fallbackHtml = fallbackText
    ? `<div style="margin-top:6px;font-family:${escapeHtml(theme.fontFamily)};font-size:${Math.max(11, theme.baseFontSize - 3)}px;color:#64748b;">${fallbackText}</div>`
    : "";

  return `
<tr>
  <td style="padding:14px 24px;text-align:center;">
    ${videoTitle ? `<div style=\"margin-bottom:8px;font-family:${escapeHtml(theme.fontFamily)};font-size:${Math.max(14, theme.baseFontSize)}px;font-weight:700;color:${escapeHtml(theme.textColor)};\">${videoTitle}</div>` : ""}
    ${wrapped}
    ${ctaHtml}
    ${captionHtml}
    ${fallbackHtml}
  </td>
</tr>`;
}

function renderFileLinkBlock(block: OyamaEmailBlock, theme: RenderTheme): string {
  const label = escapeHtml(asString(block.fileLabel).trim() || "Download Resource");
  const href = escapeHtml(asString(block.fileUrl).trim() || "#");
  const description = escapeHtml(asString(block.fileDescription).trim());

  return `
<tr>
  <td style="padding:14px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #dbe5df;border-radius:10px;background:#f8fafc;">
      <tr>
        <td style="padding:12px 14px;font-family:${escapeHtml(theme.fontFamily)};">
          <a href="${href}" style="display:inline-block;background:#0f5c3c;color:#ffffff;padding:10px 14px;border-radius:8px;text-decoration:none;font-size:${Math.max(12, theme.baseFontSize - 2)}px;font-weight:700;">${label}</a>
          ${description ? `<div style=\"margin-top:8px;font-size:${Math.max(11, theme.baseFontSize - 3)}px;line-height:${theme.lineHeight};color:#64748b;\">${description}</div>` : ""}
        </td>
      </tr>
    </table>
  </td>
</tr>`;
}

function renderHtmlBlock(block: OyamaEmailBlock, theme: RenderTheme): string {
  // Advanced Editor content is sent through the same email-safe rich-text
  // formatter as ordinary text blocks so list semantics survive delivery.
  const html = formatEmailRichTextHtml(asString(block.html), theme);
  return `
<tr>
  <td style="padding:14px 24px;">${html}</td>
</tr>`;
}

function renderGlobalHeader(chrome: OyamaEmailGlobalChrome | undefined, theme: RenderTheme): string {
  const html = sanitizeRichHtml(asString(chrome?.globalHeaderHtml));
  if (html) {
    return `
<tr>
  <td style="padding:18px 24px;border-bottom:1px solid #e2e8f0;background:#ffffff;font-family:${escapeHtml(theme.fontFamily)};">
    ${html}
  </td>
</tr>`;
  }

  const organizationName = asString(chrome?.organizationName).trim();
  const tagline = asString(chrome?.tagline).trim();
  const logoUrl = asString(chrome?.logoUrl).trim() || asString(chrome?.logoSquareUrl).trim();
  if (!organizationName && !tagline && !logoUrl) return "";

  return `
<tr>
  <td style="padding:18px 24px;border-bottom:1px solid #e2e8f0;background:#ffffff;font-family:${escapeHtml(theme.fontFamily)};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        ${logoUrl ? `<td width="76" style="vertical-align:middle;padding-right:14px;"><img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(organizationName || "Organization logo")}" style="display:block;max-width:72px;max-height:54px;width:auto;height:auto;" /></td>` : ""}
        <td style="vertical-align:middle;">
          ${organizationName ? `<div style="font-size:${Math.max(18, theme.baseFontSize + 3)}px;line-height:1.25;font-weight:700;color:${escapeHtml(theme.textColor)};">${escapeHtml(organizationName)}</div>` : ""}
          ${tagline ? `<div style="margin-top:3px;font-size:${Math.max(11, theme.baseFontSize - 3)}px;line-height:${theme.lineHeight};color:#64748b;">${escapeHtml(tagline)}</div>` : ""}
        </td>
      </tr>
    </table>
  </td>
</tr>`;
}

function renderFooter(settings: OyamaEmailTemplateSettings, theme: RenderTheme, chrome?: OyamaEmailGlobalChrome): string {
  const parts: string[] = [];
  const globalFooterHtml = sanitizeRichHtml(asString(chrome?.globalFooterHtml));
  const globalFooterLegalText = asString(chrome?.footerLegalText).trim();
  const globalAddress = asString(chrome?.addressLine).trim();
  const globalContact = [
    asString(chrome?.contactEmail).trim(),
    asString(chrome?.contactPhone).trim(),
    asString(chrome?.websiteUrl).trim(),
  ].filter(Boolean).join(" · ");

  if (globalFooterHtml) {
    parts.push(`<div>${globalFooterHtml}</div>`);
  } else if (globalFooterLegalText) {
    parts.push(`<div>${escapeHtml(globalFooterLegalText)}</div>`);
  } else if (settings.footerBrandingText.trim()) {
    parts.push(`<div>${escapeHtml(settings.footerBrandingText.trim())}</div>`);
  }

  if (settings.includePhysicalAddress) {
    const address = globalAddress || settings.physicalAddress.trim();
    if (address) parts.push(`<div>${escapeHtml(address)}</div>`);
  }

  if (globalContact) {
    parts.push(`<div>${escapeHtml(globalContact)}</div>`);
  }

  if (settings.includeUnsubscribeLink) {
    parts.push('<div><a href="{{unsubscribeUrl}}" style="color:#475569;text-decoration:underline;">Unsubscribe</a> · <a href="{{managePreferencesUrl}}" style="color:#475569;text-decoration:underline;">Manage Preferences</a></div>');
  }

  if (parts.length === 0) return "";

  return `
<tr>
  <td style="padding:18px 24px;border-top:1px solid #e2e8f0;background:#f8fafc;text-align:center;font-family:${escapeHtml(theme.fontFamily)};font-size:${Math.max(11, theme.baseFontSize - 3)}px;line-height:${theme.lineHeight};color:#475569;">
    ${parts.join("")}
  </td>
</tr>`;
}

export function extractMergeFieldsFromContent(value: string): string[] {
  return Array.from(new Set(extractEmailMergeTokens(value))).sort();
}

export function applyMergeTokens(value: string, vars: Record<string, string>): string {
  const resolve = (rawKey: string): string => {
    const key = canonicalizeEmailMergeToken(String(rawKey || "").trim());
    if (!key) return "";
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      return vars[key] ?? "";
    }
    return "";
  };

  return value
    .replace(MERGE_FIELD_PATTERN, (_token, rawKey: string) => resolve(rawKey))
    .replace(SIMPLE_BRACE_FIELD_PATTERN, (_token, prefix: string, rawKey: string) => `${prefix}${resolve(rawKey)}`)
    .replace(SLASH_FIELD_PATTERN, (_token, prefix: string, rawKey: string) => `${prefix}${resolve(rawKey)}`);
}

export function htmlToPlainText(value: string): string {
  const listStack: Array<{ index: number; ordered: boolean }> = [];
  const withListMarkers = value.replace(/<\s*(\/?)\s*(ul|ol|li)\b([^>]*)>/gi, (_tag, closingToken: string, rawTag: string, attributes: string) => {
    const closing = closingToken === "/";
    const tag = rawTag.toLowerCase();
    if (tag === "ul" || tag === "ol") {
      if (closing) listStack.pop();
      else {
        const requestedStart = Number.parseInt(attributes.match(/\bstart\s*=\s*["']?([0-9]+)/i)?.[1] ?? "", 10);
        listStack.push({ index: tag === "ol" && Number.isFinite(requestedStart) ? requestedStart : 1, ordered: tag === "ol" });
      }
      return "\n";
    }
    if (closing) return "\n";
    const list = listStack[listStack.length - 1] ?? { index: 1, ordered: false };
    const marker = list.ordered ? `${list.index}.` : "-";
    list.index += 1;
    return `\n${"  ".repeat(Math.max(0, listStack.length - 1))}${marker} `;
  });

  return withListMarkers
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*p\s*>/gi, "\n\n")
    .replace(/<\s*\/\s*h[1-6]\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/(?<=\S)[ \t]{2,}/g, " ")
    .trim();
}

export function renderEmailTemplateDocument(
  template: OyamaEmailTemplateDocument,
  settings: OyamaEmailTemplateSettings,
  chrome?: OyamaEmailGlobalChrome,
): RenderEmailTemplateResult {
  const baseTheme = themeFromTemplate(template);
  const theme: RenderTheme = {
    ...baseTheme,
    fontFamily: sanitizeFontFamily(asString(chrome?.emailFontFamily).trim() || baseTheme.fontFamily),
    linkColor: asString(chrome?.primaryColor).trim() || baseTheme.linkColor,
  };
  const globalHeader = renderGlobalHeader(chrome, theme);
  const body = template.blocks
    .map((block) => {
      if (block.type === "header") return renderHeaderBlock(block, theme);
      if (block.type === "text") return renderTextBlock(block, theme);
      if (block.type === "image") return renderImageBlock(block);
      if (block.type === "button" || block.type === "donationButton" || block.type === "eventButton") return renderButtonBlock(block);
      if (block.type === "divider") return renderDividerBlock(block);
      if (block.type === "spacer") return renderSpacerBlock(block);
      if (block.type === "columns") return renderColumnsBlock(block, theme);
      if (block.type === "social") return renderSocialBlock(block, theme);
      if (block.type === "video") return renderVideoBlock(block, theme);
      if (block.type === "fileLink") return renderFileLinkBlock(block, theme);
      return renderHtmlBlock(block, theme);
    })
    .join("\n");

  const footer = renderFooter(settings, theme, chrome);
  const contentWidth = clamp(asNumber(chrome?.emailContentWidth, template.contentWidth), 420, 760);
  const bg = escapeHtml(asString(chrome?.emailBackgroundColor).trim() || template.backgroundColor || "#f3f7f5");
  const linkColor = escapeHtml(theme.linkColor);

  const renderedHtml = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${bg};">
    <style>
      .oyama-email-root a { color: ${linkColor}; }
      .oyama-email-root h1,
      .oyama-email-root h2,
      .oyama-email-root h3,
      .oyama-email-root h4,
      .oyama-email-root h5,
      .oyama-email-root h6 { margin: 0 0 0.55em 0; color: ${escapeHtml(theme.textColor)}; }
      .oyama-email-root h2 { font-size: ${Math.max(theme.baseFontSize + 8, 24)}px; line-height: 1.24; }
      .oyama-email-root h3 { font-size: ${Math.max(theme.baseFontSize + 4, 20)}px; line-height: 1.28; }
      .oyama-email-root p { margin: 0 0 0.95em 0; }
      .oyama-email-root ul { display: block; list-style-type: disc; margin: 0 0 0.95em 0; padding: 0 0 0 26px; }
      .oyama-email-root ol { display: block; list-style-type: decimal; margin: 0 0 0.95em 0; padding: 0 0 0 26px; }
      .oyama-email-root li { display: list-item; margin: 0 0 0.35em 0; padding: 0; }
    </style>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${bg};">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table class="oyama-email-root" role="presentation" width="${contentWidth}" cellpadding="0" cellspacing="0" border="0" style="width:${contentWidth}px;max-width:100%;background:#ffffff;border:1px solid #dbe5df;border-radius:14px;overflow:hidden;">
            ${globalHeader}
            ${body}
            ${footer}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const html = absolutizeEmailAssetUrls(renderedHtml, chrome?.publicAssetBaseUrl);

  const plainTextOverride = asString(settings.plainTextOverride).trim();
  const text = settings.enablePlainTextVersion ? (plainTextOverride || htmlToPlainText(html)) : "";
  const mergeFieldsUsed = extractMergeFieldsFromContent(html);

  return {
    html,
    text,
    mergeFieldsUsed,
  };
}

export function renderEmailTemplateDocumentWithMerge(
  template: OyamaEmailTemplateDocument,
  settings: OyamaEmailTemplateSettings,
  vars: Record<string, string>,
  chrome?: OyamaEmailGlobalChrome,
): RenderEmailTemplateResult {
  const rendered = renderEmailTemplateDocument(template, settings, chrome);
  return {
    html: applyMergeTokens(rendered.html, vars),
    text: applyMergeTokens(rendered.text, vars),
    mergeFieldsUsed: rendered.mergeFieldsUsed,
  };
}
